// FIXME: optimize rendering, it burns my laptop
// TODO: make canvas smaller, to fit only earth without any padding
// TODO: import from three.js + bundler
// TODO: add loader while images are loading
// TODO: images: optimize jpg and convert to webp
// TODO: add resize handler
// TODO: add touch events
// TODO: add mobile support
// TODO: better animation when user stops rotating

const EARTH_RADIUS = 0.5;
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

    this.scene = null;
    this.camera = null;
    this.light = null;
    this.renderer = null;

    this.distanceToEdge = null;

    this.dots = [];
    this.loader = new THREE.ImageLoader();
    this.spinning = true;

    this.init();
  }

  init() {
    // Create a scene
    const scene = (this.scene = new THREE.Scene());
    const camera = (this.camera = new THREE.PerspectiveCamera(
      45, // field of view
      this.container.offsetWidth / this.container.offsetHeight, // aspect ratio
      // near and far clipping plane
      0.1,
      100
    ));

    // Create the planet
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 32, 32),
      new THREE.MeshPhongMaterial()
    );
    scene.add(sphere);

    // Add the light
    scene.add(new THREE.AmbientLight(0x909090));
    const light = (this.light = new THREE.DirectionalLight(0x4f4f4f, 1));
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
      new THREE.Vector3(0, EARTH_RADIUS, 0)
    );

    // Create a renderer
    const renderer = (this.renderer = new THREE.WebGLRenderer({
      antialias: true
    }));
    // on HiDPI devices prevents bluring output canvas
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(this.container.offsetWidth, this.container.offsetHeight);
    this.container.appendChild(renderer.domElement);

    // main texture
    // the idea is to use different pictures depends on the current month
    // source of images: https://visibleearth.nasa.gov/view_cat.php?categoryID=1484
    // FIXME: will need to resize images, they are huge
    let mainTexture = 'world.200409.3x5400x2700.jpg';
    // TODO: add more months
    const currentMonth = new Date().getMonth();
    if (currentMonth > 9 || currentMonth < 3) {
      mainTexture = 'world.200412.3x5400x2700.jpg';
    }
    this.loader.load(`images/${mainTexture}`, mapImage => {
      sphere.material.map = new THREE.CanvasTexture(mapImage);
      this.load();
    });
    // make height bumps on the surface
    this.loader.load('images/earthbump1k.jpg', mapImage => {
      sphere.material.bumpMap = new THREE.CanvasTexture(mapImage);
      sphere.material.bumpScale = 0.05;
      this.load();
    });
    // makes water to reflect more light than land
    this.loader.load('images/earthspec1k.jpg', mapImage => {
      sphere.material.specularMap = new THREE.CanvasTexture(mapImage);
      sphere.material.specular = new THREE.Color('grey');
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
    requestAnimationFrame(this.animate.bind(this));

    if (this.spinning) {
      // rotate camera around Earth instead of rotating the earth to keep Sun at the same point
      setPosition(
        this.camera.position,
        ORBIT_RADIUS,
        INITIAL_COORDS.latitude,
        this.cameraLong
      );
      this.camera.lookAt(0, 0, 0);
      this.cameraLong += 0.1;
    }

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
        const dot = new THREE.Sprite(new THREE.SpriteMaterial());
        dot.material.depthTest = false;
        dot.scale.set(0.05, 0.05, 1);
        dot.center.set(0.5, 0);
        const loc = m.location;
        setPosition(dot.position, EARTH_RADIUS, loc.lat, loc.long);
        this.scene.add(dot);

        return dot;
      });

    this.loader.load('images/map-marker.png', image => {
      this.dots.forEach(dot => {
        dot.material.map = new THREE.CanvasTexture(image);
      });

      this.load();
    });

    // like this I can make a dot bigger when user hovers on somebody
    // this.dots[0].scale.set(0.07, 0.07, 1);
  }

  attach() {
    let rotateStart;

    this.container.addEventListener('mouseover', () => {
      this.spinning = false;
    });

    this.container.addEventListener('mouseout', () => {
      this.spinning = true;
    });

    const mouseMove = e => this.move(rotateStart, [e.clientX, e.clientY]);
    const mouseUp = () => {
      document.removeEventListener('mousemove', mouseMove, false);
      document.removeEventListener('mouseup', mouseUp, false);
    };

    this.container.addEventListener('mousedown', e => {
      // only left button
      if (e.button === 0) {
        rotateStart = [e.clientX, e.clientY];
        e.preventDefault();
        document.addEventListener('mousemove', mouseMove, false);
        document.addEventListener('mouseup', mouseUp, false);
        this.container.classList.add('is-grabbing');
      }
    });
  }

  move(start, end) {
    const PI2 = 2 * Math.PI;
    const canvasHeight = this.container.offsetHeight * 10;
    const delta = new THREE.Spherical();
    delta.setFromVector3(this.camera.position);

    delta.theta -= (PI2 * (end[0] - start[0])) / canvasHeight;
    delta.phi -= (PI2 * (end[1] - start[1])) / canvasHeight;

    delta.makeSafe();
    this.camera.position.setFromSpherical(delta);
    this.camera.lookAt(0, 0, 0);
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
