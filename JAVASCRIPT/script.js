let scene, camera, renderer, modelGroup;
let targetRotationX = 0;
let targetRotationY = 0;
let isMobile = false;
let sensorEnabled = false;
let enableButton;

function init() {
    console.log("Initializing...");

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);

    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const loader = new THREE.GLTFLoader();
    loader.load(
        '/3DM/K2G_EMBLEM.glb',
        function (gltf) {
            const model = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1 / maxDim;
            model.scale.multiplyScalar(scale);

            model.position.sub(center.multiplyScalar(scale));

            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            modelGroup.add(model);

            const aspectRatio = window.innerWidth / window.innerHeight;
            const viewSize = Math.max(size.x * scale * aspectRatio, size.y * scale);
            const distance = viewSize / (2 * Math.tan(Math.PI * camera.fov / 360));
            camera.position.set(0, 0, distance * 1.5);
            camera.lookAt(0, 0, 0);

            directionalLight.target = modelGroup;
            scene.add(directionalLight.target);

            console.log("Model loaded successfully");
        },
        undefined,
        function (error) {
            console.error('An error happened while loading the model:', error);
        }
    );

    detectDevice();

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function detectDevice() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log("Is mobile device:", isMobile);

    if (isMobile) {
        console.log("Mobile device detected. Setting up motion controls...");
        setupMotionControls();
    } else {
        console.log("Desktop device detected. Setting up mouse control.");
        document.addEventListener('mousemove', handleMouseMove);
    }
}

function setupMotionControls() {
    enableButton = document.createElement("button");
    enableButton.textContent = "Enable Motion Controls";
    enableButton.style.position = "fixed";
    enableButton.style.bottom = "20px";
    enableButton.style.left = "50%";
    enableButton.style.transform = "translateX(-50%)";
    enableButton.style.padding = "10px 20px";
    enableButton.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    enableButton.style.color = "white";
    enableButton.style.border = "none";
    enableButton.style.borderRadius = "5px";
    enableButton.style.zIndex = "1000";

    enableButton.addEventListener("click", requestMotionPermission);
    document.body.appendChild(enableButton);
}

function requestMotionPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    enableMotionControls();
                } else {
                    console.log("Permission not granted for motion sensors");
                    alert("Permission not granted for motion sensors. Please enable it in your device settings and try again.");
                }
            })
            .catch(console.error);
    } else {
        // For non-iOS devices or older iOS versions
        enableMotionControls();
    }
}

function enableMotionControls() {
    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('devicemotion', handleMotion, true);
    sensorEnabled = true;
    enableButton.style.display = 'none';
    console.log("Motion controls enabled");
}

function handleOrientation(event) {
    if (!sensorEnabled) return;

    let { beta, gamma } = event;

    // Normalize beta and gamma to the range [-1, 1]
    const x = Math.max(Math.min(gamma / 90, 1), -1);
    const y = Math.max(Math.min(beta / 90, 1), -1);

    // Apply the rotation
    targetRotationX = y * Math.PI / 3; // Rotate around X-axis
    targetRotationY = x * Math.PI / 3; // Rotate around Y-axis
}

function handleMotion(event) {
    if (!sensorEnabled) return;

    const { x, y, z } = event.accelerationIncludingGravity;

    // Use acceleration to add some "responsiveness" to the tilt
    targetRotationX += y * 0.001;
    targetRotationY += x * 0.001;

    // Limit rotation
    const maxRotation = Math.PI / 3; // 60 degrees
    targetRotationX = Math.max(Math.min(targetRotationX, maxRotation), -maxRotation);
    targetRotationY = Math.max(Math.min(targetRotationY, maxRotation), -maxRotation);
}

function handleMouseMove(event) {
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const distanceFromCenter = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
    const tiltStrength = 2 - Math.min(distanceFromCenter, 1);
    
    const maxTilt = Math.PI / 6; // 30 degrees max tilt
    targetRotationY = mouseX * maxTilt * tiltStrength;
    targetRotationX = -mouseY * maxTilt * tiltStrength; // Invert Y-axis for intuitive tilt
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (modelGroup) {
        // Smoothly interpolate current rotation to target rotation
        modelGroup.rotation.x += (targetRotationX - modelGroup.rotation.x) * 0.1;
        modelGroup.rotation.y += (targetRotationY - modelGroup.rotation.y) * 0.1;
    }

    renderer.render(scene, camera);
}

init();