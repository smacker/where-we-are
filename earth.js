import { AmbientLight } from 'three/src/lights/AmbientLight';
import { CanvasTexture } from 'three/src/textures/CanvasTexture';
import { Color } from 'three/src/math/Color';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { ImageLoader } from 'three/src/loaders/ImageLoader';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshPhongMaterial } from 'three/src/materials/MeshPhongMaterial';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { Scene } from 'three/src/scenes/Scene';
import { SphereBufferGeometry } from 'three/src/geometries/SphereGeometry';
import { Spherical } from 'three/src/math/Spherical';
import { Sprite } from 'three/src/objects/Sprite';
import { SpriteMaterial } from 'three/src/materials/SpriteMaterial';
import { Vector3 } from 'three/src/math/Vector3';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import images from './images/*.*';

// Performance note:
// it does consume some considerable amount of CPU/GPU
// but profiling shows that rendering happens super quick
// reducing number of fps helps a lot but makes the pic look much worse

// TODO: add touch events
// TODO: add mobile support
// TODO: better animation when user stops rotating
// TODO: add popup with location name on pin hover
// TODO: make pin bigger on member hover
// TODO: move webp checker and texture selector to separate script to be able to preload them

const EARTH_RADIUS = 0.7;
// where the camera is located
const ORBIT_RADIUS = 2;
// initial coordinates for the camera
const INITIAL_COORDS = {
  latitude: 40.4167754,
  longitude: -3.7037902
};

class Earth {
  constructor(container) {
    this.cameraLong = INITIAL_COORDS.longitude;
    this.loaded = 0;
    this.container = container;
    this.canvas = this.container.querySelector('canvas');

    this.scene = null;
    this.camera = null;
    this.light = null;
    this.renderer = null;

    this.distanceToEdge = null;

    this.dots = [];
    this.loader = new ImageLoader();
    this.spinning = true;

    this.resizeCanvas();
    this.init();

    this.animate = this.animate.bind(this);
  }

  init() {
    // Create a scene
    const scene = (this.scene = new Scene());
    const camera = (this.camera = new PerspectiveCamera(
      45, // field of view
      1, // aspect ratio
      // near and far clipping plane
      0.1,
      100
    ));

    // Create the planet
    const sphere = new Mesh(
      new SphereBufferGeometry(EARTH_RADIUS, 32, 32),
      new MeshPhongMaterial()
    );
    scene.add(sphere);

    // Add the light
    scene.add(new AmbientLight(0x909090));
    const light = (this.light = new DirectionalLight(0x4f4f4f, 1));
    scene.add(light);

    this.moveSun();

    // position camera to inital coordinates and make it look to the scene center
    setPosition(
      camera.position,
      ORBIT_RADIUS,
      INITIAL_COORDS.latitude,
      INITIAL_COORDS.longitude
    );
    camera.lookAt(0, 0, 0);

    this.distanceToEdge = camera.position.distanceTo(
      new Vector3(0, EARTH_RADIUS, 0)
    );

    // Create a renderer
    const renderer = (this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    }));
    // on HiDPI devices prevents bluring output canvas
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);

    isWebpSupported(supported => {
      this.isWebp = supported;
      this.loadTextures(sphere);
    });
  }

  loadTextures(sphere) {
    // main texture
    // the idea is to use different pictures depends on the current month
    // source of images: https://visibleearth.nasa.gov/view_cat.php?categoryID=1484
    // all images are resized to 2048x1024px and optimized using:
    //
    // #!/bin/bash
    // for i in $(seq -f "%02g" 1 12); do
    //     convert "images/origin/world.2004$i.3x5400x2700.jpg" -resize 2048x1024 "images/world.2004$i.jpg"
    //     convert "images/world.2004$i.jpg" "images/world.2004$i.webp"
    // done
    //
    const currentMonth = new Date().getMonth() + 1;
    const paddingZero = currentMonth < 10 ? '0' : '';
    const ext = this.isWebp ? 'webp' : 'jpg';
    const mainTexture = `2004${paddingZero}${currentMonth}.${ext}`;
    this.loader.load(images.world[`${mainTexture}`], mapImage => {
      sphere.material.map = new CanvasTexture(mapImage);
      this.load();
    });

    // Bump and specular textures are taken from: http://planetpixelemporium.com/earth.html
    // and optimized using:
    //
    // #!/bin/bash
    // for i in earthbump1k earthspec1k
    // do
    //     convert "images/origin/$i.jpg" -resize 512x256  "images/$i.jpg"
    //     convert "images/$i.jpg"  "images/$i.webp"
    // done
    //
    // make height bumps on the surface
    this.loader.load(images.earthbump1k[ext], mapImage => {
      sphere.material.bumpMap = new CanvasTexture(mapImage);
      sphere.material.bumpScale = 0.02;
      this.load();
    });
    //
    // makes water to reflect more light than land
    this.loader.load(images.earthspec1k[ext], mapImage => {
      sphere.material.specularMap = new CanvasTexture(mapImage);
      sphere.material.specular = new Color('grey');
      this.load();
    });
  }

  moveSun() {
    // https://en.wikipedia.org/wiki/Position_of_the_Sun#Calculations
    const now = new Date();
    const solstice = new Date(now.getFullYear() + '-06-21 00:00:00');
    const days = (now - solstice) / (1000 * 60 * 60 * 24);
    const sunLat = 23.44 * Math.cos((2 * Math.PI * days) / 365.26);
    const sunLong = 180 - 15 * (now.getUTCHours() + now.getMinutes() / 60);
    setPosition(this.light.position, ORBIT_RADIUS, sunLat, sunLong);
  }

  animate() {
    if (!this.spinning) {
      return;
    }

    // rotate camera around Earth instead of rotating the earth to keep Sun at the same point
    setPosition(
      this.camera.position,
      ORBIT_RADIUS,
      INITIAL_COORDS.latitude,
      this.cameraLong
    );
    this.camera.lookAt(0, 0, 0);
    this.cameraLong -= 0.1;

    this.render();

    requestAnimationFrame(this.animate);
  }

  render() {
    this.dots.forEach(dot => {
      const distance = this.camera.position.distanceTo(dot.position);
      dot.material.depthTest = distance > this.distanceToEdge;
    });

    this.renderer.render(this.scene, this.camera);
  }

  load() {
    this.loaded++;
    if (this.loaded < 4) {
      return;
    }

    this.container.classList.add('loaded');
    this.attach();
    this.animate();
  }

  addMembers(members) {
    const seen = {};
    this.dots = members
      .filter(m => !!m.location)
      .filter(m => {
        if (seen[m.location.name]) {
          return false;
        }
        seen[m.location.name] = true;
        return true;
      })
      .map(m => {
        const dot = new Sprite(new SpriteMaterial());
        dot.material.depthTest = false;
        dot.scale.set(0.05, 0.05, 1);
        dot.center.set(0.5, 0);
        const loc = m.location;
        setPosition(dot.position, EARTH_RADIUS, loc.lat, loc.long);
        this.scene.add(dot);

        return dot;
      });

    this.loader.load(images['map-marker']['png'], image => {
      this.dots.forEach(dot => {
        dot.material.map = new CanvasTexture(image);
      });

      this.load();
    });

    // like this I can make a dot bigger when user hovers on somebody
    // this.dots[0].scale.set(0.07, 0.07, 1);
  }

  attach() {
    let rotateStart;

    this.canvas.addEventListener('mouseover', () => {
      this.spinning = false;
    });

    this.canvas.addEventListener('mouseout', () => {
      this.spinning = true;
      this.animate();
    });

    const mouseMove = e => this.move(rotateStart, [e.clientX, e.clientY]);
    const mouseUp = () => {
      this.container.classList.remove('is-grabbing');
      document.removeEventListener('mousemove', mouseMove, false);
      document.removeEventListener('mouseup', mouseUp, false);
    };

    this.canvas.addEventListener('mousedown', e => {
      // only left button
      if (e.button === 0) {
        rotateStart = [e.clientX, e.clientY];
        e.preventDefault();
        document.addEventListener('mousemove', mouseMove, false);
        document.addEventListener('mouseup', mouseUp, false);
        this.container.classList.add('is-grabbing');
      }
    });

    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
    });
  }

  move(start, end) {
    const PI2 = 2 * Math.PI;
    const canvasHeight = this.canvas.offsetHeight * 10;
    const delta = new Spherical();
    delta.setFromVector3(this.camera.position);

    delta.theta -= (PI2 * (end[0] - start[0])) / canvasHeight;
    delta.phi -= (PI2 * (end[1] - start[1])) / canvasHeight;

    delta.makeSafe();
    this.camera.position.setFromSpherical(delta);
    this.camera.lookAt(0, 0, 0);

    this.render();
  }

  resizeCanvas() {
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;
    const canvasSize = containerW < containerH ? containerW : containerH;
    this.canvas.style.width = canvasSize + 'px';
    this.canvas.style.height = canvasSize + 'px';
    this.canvas.style.marginTop = 0 - canvasSize / 2 + 'px';
    this.canvas.style.marginLeft = 0 - canvasSize / 2 + 'px';
  }
}

// map latitude & longitude on a sphere
function setPosition(position, radius, latitude, longitude) {
  let phi = (90 - latitude) * (Math.PI / 180);
  let theta = (longitude + 180) * (Math.PI / 180);

  position.x = -radius * Math.sin(phi) * Math.cos(theta);
  position.z = radius * Math.sin(phi) * Math.sin(theta);
  position.y = radius * Math.cos(phi);
}

// Snippet adapdate from the official doc:
// https://developers.google.com/speed/webp/faq#how_can_i_detect_browser_support_for_webp
function isWebpSupported(callback) {
  let img = new Image();
  img.onload = () => callback(img.width > 0 && img.height > 0);
  img.onerror = () => callback(false);
  img.src =
    'data:image/webp;base64,' +
    'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
}

export default Earth;
