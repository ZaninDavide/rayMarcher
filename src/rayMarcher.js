var program
var paused = false
var time = 0
var oldTimestamp = -1
var updateShader = true
let input, button, greeting

function setup() {
  pixelDensity(1)

  createCanvas(windowWidth, windowHeight, WEBGL)
  gl = this.canvas.getContext("webgl")
  rectMode(CENTER)
  noStroke()
  fill(1)
}

function draw() {
  if (updateShader) {
    program = createShader(vert, frag())
    updateShader = false
  }
  if (oldTimestamp == -1) oldTimestamp = millis()
  if (!paused) {
    currentTimestamp = millis()
    time += currentTimestamp - oldTimestamp
    oldTimestamp = currentTimestamp
  }

  shader(program)
  let mx = map(mouseX, 0, width, 0, 1)
  let my = map(mouseY, 0, height, 0, 1)
  background(0)

  program.setUniform("mouse", [mx, my])
  program.setUniform("resolution", [width, height])
  program.setUniform("time", time / 1000)

  rect(0, 0, width, height)
  //console.log(time / 1000)
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

function mouseClicked() {
  if (paused) oldTimestamp = millis()
  paused = !paused
}

window.onwheel = function(e) {
  e.preventDefault()

  zoom *= 1 - e.deltaY * 0.003
  fuzzy *= 1 - e.deltaX * 0.003
}

var vert = `
attribute vec3 aPosition;
precision highp float;
uniform vec2 resolution;
uniform float time;

void main() {
  vec4 positionVec4 = vec4(aPosition, 1.0);
  positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
  gl_Position = positionVec4;
}
`

function frag() {
  return `precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform vec2 mouse;
  uniform bool signPlot;
    
  float PI = 3.14159265;
  
  // ray marching
  const int max_iterations = 600; // how many step could I walk (32-600)
  float stepFactor = 0.99; // how further I go related to the distance found
  float accuracy = 0.005; // how close have I to get
  
  // camera
  float fNear = 3.0;
  float fog_distance = 700./*1.5*/;
  vec3 light = normalize(vec3(1, 1, 1));
  float minLight = 0.1;
  
  // MATH --------------------------------------------------------------
  
  vec3 rotate(vec3 point, vec3 rotation){
      // rotation on the x axes
      float cx = cos(rotation.x);
      float sx = sin(rotation.x);
      mat4 rotationMatX = mat4(
        vec4(1,   0,   0, 0),
          vec4(0,  cx,  sx, 0),
          vec4(0, -sx,  cx, 0),
          vec4(0,   0,   0, 1)
      );
      // rotation on the y axes
      float cy = cos(rotation.y);
      float sy = sin(rotation.y);
      mat4 rotationMatY = mat4(
        vec4( cy,   0,  sy, 0),
          vec4(  0,   1,   0, 0),
          vec4(-sy,   0,  cy, 0),
          vec4(  0,   0,   0, 1)
      );
      // rotation on the z axes
      float cz = cos(rotation.z);
      float sz = sin(rotation.z);
      mat4 rotationMatZ = mat4(
        vec4( cz,  sz,   0, 0),
          vec4(-sz,  cz,   0, 0),
          vec4(  0,   0,   1, 0),
          vec4(  0,   0,   0, 1)
      );
      
    return (vec4(point, 1) * (rotationMatX * rotationMatY * rotationMatZ)).xyz;
  }
  
  
  // STRUCTURES ---------------------------------------------------------
  
  struct hitRes{
    float dist;
    vec3 norm;
    vec4 color;
  };
  
  struct Plane{
    float altitude;
    vec3 rot;
    vec4 color;
  };
      
  hitRes getDist(Plane pla, vec3 p){
    float dist = p.y - pla.altitude;
    hitRes hit;
    hit.dist = dist;
    hit.color = pla.color;
    return hit;
  }
  
  struct Sphere{ 
    vec3 pos;
    vec3 scale;
    vec3 rot;
    vec4 color;
  };
      
  hitRes getDist(Sphere sph, vec3 p){
    p = rotate(p / sph.scale, -sph.rot) - sph.pos;
    
    float dist = length(p) - 1.0;
    hitRes hit;
    hit.dist = dist;
    hit.color = sph.color;
    return hit;
  }
  
  
  struct Box{ 
    vec3 pos;
    vec3 scale;
    vec3 rot;
    vec4 color;
  };
  
  hitRes getDist( Box b, vec3 p){    
    p = rotate(p / b.scale, -b.rot) - b.pos;
    vec3 dist_vec = abs(p) - vec3(1.0);
    float dist = length(max(dist_vec, 0.0));
  
    hitRes hit;
    hit.dist = dist;
    hit.color = b.color;
    return hit;
  }
  
  struct Torus{
    vec3 pos;
    vec3 scale;
    vec3 rot;
    vec4 color;
    float r1; // big radius
    float r2; // small radius
  };
  
  hitRes getDist( Torus tor, vec3 p){
    p = rotate(p / tor.scale, -tor.rot) - tor.pos;
    vec2 q = vec2(length(p.xz) - tor.r1, p.y);
    float dist = length(q) - tor.r2;
  
    hitRes hit;
    hit.dist = dist;
    hit.color = tor.color;
    return hit;
  }
  
  // END STRUCTURES -----------------------------------------------------
  
  hitRes min(hitRes a, hitRes b){
    if(a.dist <= b.dist){
      return a;
    }else{
      return b;
    }
  }
  
  
  hitRes max(hitRes a, hitRes b){
    if(a.dist >= b.dist){
      return a;
    }else{
      return b;
    }
  }
  
  hitRes distanceField(vec3 p)
  {
    // SCENE OBJECTS HERE --------------------------------------------- 
    Sphere sph;
    sph.scale = vec3(2);
    sph.color = vec4(1, 1, 1, 1);
    
    Box b;
    b.scale = vec3(1, 1.5, 1);
    b.rot = vec3(0, time, 0);
    b.pos = vec3(3., 0., 0.);
    b.color = vec4(1, 1, 1, 1);
    
    Torus tor;
    tor.scale = vec3(1, 1, 1);
    tor.rot = vec3(time, 0, 0);
    tor.r1 = 1.0;
    tor.r2 = .5;
    tor.color = vec4(.3, 1, 1, 1);
    
    Plane pla;
    pla.altitude = -1.5;
    pla.color = vec4(1, 0, 0, 1);
  
    hitRes minimum = min(min(getDist(pla, p), getDist(tor, p)), getDist(b, p));
  
    return minimum;
  }
  
  vec3 getNormal(vec3 p){
    vec3 n;
    vec2 shift = vec2(.001, 0);
    float d = distanceField(p).dist;
      
    n = d - vec3(
      distanceField(p - shift.xyy).dist,
      distanceField(p - shift.yxy).dist,
      distanceField(p - shift.yyx).dist
    );
    return normalize(n);
  }
  
  
  hitRes trace(vec3 ray_origin, vec3 direction){
      
    float t_dist = 0.0; // travelled distance on the ray
      
      for(int i = 0; i < max_iterations; i++){
          
        vec3 point = ray_origin + direction * t_dist; // where is the point on the ray now
          
          hitRes hit_d = distanceField(point);
          float d =  hit_d.dist;
          t_dist += d * stepFactor;
          
          if (d <= accuracy){ // hit something
            hitRes hit_final;
            hit_final.color = hit_d.color;
            hit_final.norm = getNormal(point);
            hit_final.dist = t_dist;
            return hit_final;
            //fog_distance - (t_dist / fog_distance); 
          }
      }
      hitRes noHit;
      noHit.dist = 0.;
      return noHit;
  }
  vec2 fromScreenToUV(vec2 p){
    // Normalized pixel coordinates 
    vec2 uv = vec2(p.x / resolution.x, p.y / resolution.y);
    uv = uv * 2.0 - vec2(1.0, 1.0);
    uv.x *= resolution.x / resolution.y;
    return uv;
  }
  
  void main( void )
  {
      // Normalized pixel coordinates 
      vec2 uv = fromScreenToUV(gl_FragCoord.xy);
      
      // camera
      vec3 direction = normalize(vec3(uv, -fNear));
      vec3 camera = vec3(0, 1., 5. + time);
      
      // light
      light = normalize(vec3(mouse.x - .35,1, 1));
  
      hitRes t = trace(camera, direction);
        
      float lightness = 0.;
      if(t.dist != 0.){
        vec3 hit = camera + direction * (t.dist - (accuracy*3.));
        lightness = minLight;
        if(trace(hit, light).dist == 0.0){
             lightness += max(dot(light, t.norm), 0.0);
        }
      }
      
      // Output to screen
      gl_FragColor = vec4(t.color.r * lightness, t.color.g * lightness, t.color.b * lightness, 1); // max(t.w / fog_distance, 0.)
      //gl_FragColor = vec4(uv.xy, 1, 1);
  }
`
}
