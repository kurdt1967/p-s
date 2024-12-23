import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'lil-gui';
import * as CANNON from 'cannon-es';


//-- SIZES --
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
};


//-- DEBUG GUI --
const gui = new dat.GUI();
// Apply CSS style to the GUI to position it at the top-left corner
gui.domElement.style.position = 'absolute';
gui.domElement.style.width = '200px';
gui.domElement.style.left = '10px';  // 10px from the left of the window
gui.domElement.style.top = '10px';   // 10px from the top of the window
gui.domElement.style.fontSize = '10px'; // Reduce font size for better display


//-- CANVAS --
const canvas = document.querySelector('canvas.webgl');


//-- THREE.JS SETUP
// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // White background
// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
camera.position.set(0, 5, 10);
scene.add(camera);
// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));


// Add grid to the scene
// GridHelper(size, divisions)
const gridHelper = new THREE.GridHelper(5, 25);  // X-axis size = 15, Z-axis divisions = 10
scene.add(gridHelper);
// Adjust the grid to be rectangular
gridHelper.scale.set(3, 2, 1);  // Stretch the grid along Z (creating rectangular shape)


//-- ORBIT CONTROLS --
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 5;
controls.maxDistance = 50;
controls.enableDamping = true;
controls.dampingFactor = 0.5;


//-- LIGHTING --
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 0.5);
pointLight.position.set(2, 3, 4);
scene.add(pointLight);


//-- MESHES --
const textureLoader = new THREE.TextureLoader();
const ballCoat = textureLoader.load( 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRMDlLaRsqYBIGrnI24hdTp_VdpjUwU16Hf-Q&s' );
//const groundCoat = textureLoader.load( 'https://img.freepik.com/free-vector/geometric-shapes-neon-lights-background_23-2148426707.jpg' );

// Materials
const ballMaterial = new THREE.MeshBasicMaterial({ map: ballCoat });
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x777777, wireframe: true });
//const groundMaterial = new THREE.MeshBasicMaterial({ map: groundCoat });

// Ball
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), ballMaterial);
ball.position.set(-7, 1.25, 0);
scene.add(ball);


// Ground (Finite Plane)
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 5), // Narrower and longer floor
    groundMaterial
);
ground.rotation.x = -Math.PI * 0.5; // Rotate to horizontal
ground.receiveShadow = true;
scene.add(ground);


//-- CANNON WORLD --
const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.gravity.set(0, -9.82, 0);


const defaultMaterial = new CANNON.Material('default');
const defaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 0.1,
        restitution: 0.7
    }
);
world.defaultContactMaterial = defaultContactMaterial;


// Finite Physics Ground Box (Static)
const groundShape = new CANNON.Box(new CANNON.Vec3(7.5, 0.25, 2.5)); // Adjust size to match the visual ground
const groundBody = new CANNON.Body({
    mass: 0, // Static body
    position: new CANNON.Vec3(0, -0.25, 0), // Slightly below the center of the ground
});
groundBody.addShape(groundShape);
world.addBody(groundBody);


// Physics Ball
const ballShape = new CANNON.Sphere(0.25); // Matches visual ball size
const ballBody = new CANNON.Body({
    mass: 1, // Set mass to 1 for the ball
    material: defaultMaterial
});
ballBody.addShape(ballShape);
ballBody.position.set(-7, 1.25, 0);
world.addBody(ballBody);


// Track objects to update
const objectsToUpdate = [
    { mesh: ball, body: ballBody }
];


//-- GUI CONTROLS --
const settings = {
    angle: 45,        // Launch angle
    velocity: 6,     // Initial velocity (speed) of the ball
    mass: 1,          // Ball mass
    launchHeight: 1, // Launch height
    airResistance: true, // Air resistance on/off
    reset: () => {
        ballBody.velocity.set(0, 0, 0); // Reset velocity
        ballBody.angularVelocity.set(0, 0, 0);
        ballBody.position.set(-7, settings.launchHeight, 0); // Set ball to launch height
    },
    launch: () => {
        ballBody.mass = settings.mass; // Set the ball's mass dynamically
        ballBody.updateMassProperties(); // Update mass properties to recalculate inertia tensor
    
        const angleInRadians = (settings.angle * Math.PI) / 180;
        const speed = settings.velocity;
    
        // Apply a scaled velocity based on mass
        // The higher the mass, the more force it would take to achieve the same velocity
        const adjustedSpeed = speed * (1 / Math.sqrt(settings.mass)); // Optional: Adjust based on mass
    
        // Set the velocity with a directional calculation (based on angle)
        ballBody.velocity.set(
            adjustedSpeed * Math.cos(angleInRadians),
            adjustedSpeed * Math.sin(angleInRadians),
            0
        );
    }
    
};


// Add GUI controls
gui.add(settings, 'angle', 0, 90, 1).name('Launch Angle');
gui.add(settings, 'velocity', 0, 100, 1).name('Launch Velocity (m/s)');
gui.add(settings, 'mass', 0.1, 100, 0.1).name('Ball Mass (kg)');
gui.add(settings, 'launchHeight', 0.5, 10, 0.1).name('Launch Height (m)'); // Launch height control
gui.add(settings, 'airResistance').name('Air Resistance');
gui.add(settings, 'reset').name('Reset');
gui.add(settings, 'launch').name('Launch');


//-- ANIMATION LOOP --
const clock = new THREE.Clock();
let oldElapsedTime = 0;


const tick = () => {
    const elapsedTime = clock.getElapsedTime();
    const deltaTime = elapsedTime - oldElapsedTime;
    oldElapsedTime = elapsedTime;


    // Update physics
    world.step(1 / 80, deltaTime, 3);


    // Update objects
    for (const object of objectsToUpdate) {
        object.mesh.position.copy(object.body.position);
        object.mesh.quaternion.copy(object.body.quaternion);
    }


    // Update controls
    controls.update();


    // Render
    renderer.render(scene, camera);


    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
};


// Handle resizing
window.addEventListener('resize', () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;


    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();


    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});


// Start the animation loop
tick();



