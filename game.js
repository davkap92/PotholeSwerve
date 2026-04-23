const canvas = document.getElementById('gameCanvas');
const healthFill = document.getElementById('healthFill');
const speedoElement = document.getElementById('speedometer');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Add road boundaries constant at the top
const ROAD_LEFT_BOUNDARY = 320;
const ROAD_RIGHT_BOUNDARY = canvas.width - 320;
const ROAD_WIDTH = ROAD_RIGHT_BOUNDARY - ROAD_LEFT_BOUNDARY;


// Game objects
const car = {
    velocityX: 0, // Add sideways velocity state
    baseX: 0, // Add base X position for shake calculation
    velocityZ: 0, // Forward/backward velocity
    health: 100,
    shakeOffset: 0,
    isShaking: false,
    shakeDuration: 0,
    shakeMagnitude: 0.5
};

// Add Handling Constants
const BASE_TURN_ACCELERATION = 0.06; // How quickly the car speeds up sideways
const BASE_MAX_TURN_SPEED = 0.9;    // Max sideways speed
const FRICTION = 0.92;              // Lateral friction when turning
const STOPPING_FRICTION = 0.80;     // Extra friction when lateral keys released

const FORWARD_ACCELERATION = 0.12; // Peak acceleration (tapers near max speed)
const BRAKING_FORCE = 0.08;       // How quickly the car slows down
const MAX_SPEED = 4;             // Maximum forward speed
const FORWARD_FRICTION = 0.985;   // Gentle coast deceleration - like engine braking

// Cache car width to avoid recalculating bounding box every frame
let cachedCarWidth = null;

// Add carMesh global variable (will hold the loaded model)
let carMesh = null;

// Add global helpers for debugging bounding boxes
// let carBoxHelper = null;
// let potholeBoxHelper = null;

const potholes = [];
const speedBumps = []; // Add array for speed bumps
const trees = {
    left: [],
    right: []
};
let score = 0;

// Game state - Back to the simpler keys object
let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false, // Still unused, but keep for consistency
    ArrowDown: false, // Still unused
    w: false,
    s: false
};
let gameOver = false;

// Event listeners - DIRECTLY modify 'keys.w' state, ignoring repeats
document.addEventListener('keydown', (e) => {
    if (e.repeat) return; // Ignore repeats

    const key = e.key.toLowerCase();

    // Handle 'w' and 's' keys for acceleration and braking
    if (key === 'w') {
        keys.w = true;
    } else if (key === 's') {
        keys.s = true;
    }
    // Handle arrows separately 
    else if (key === 'arrowleft') {
         keys.ArrowLeft = true;
    } else if (key === 'arrowright') {
         keys.ArrowRight = true;
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    // Handle 'w' and 's' keys for acceleration and braking
    if (key === 'w') {
        keys.w = false;
    } else if (key === 's') {
        keys.s = false;
    }
    // Handle arrows
    else if (key === 'arrowleft') {
         keys.ArrowLeft = false;
    } else if (key === 'arrowright') {
         keys.ArrowRight = false;
    }
});

// Create new pothole
function createPothole() {
    const minSize = 5; 
    const maxSize = 10;
    const size = minSize + Math.random() * (maxSize - minSize);

    const potholeData = {
        size: size,
        damage: Math.ceil(size * 2),
        hit: false,
        mesh: null
    };

    // Create the 3D mesh for the pothole
    const geometry = new THREE.CircleGeometry(size / 2, 16); 
    const material = new THREE.MeshStandardMaterial({ 
        map: roadTexture, 
        color: 0x777777, // Lighter dark tint
        roughness: 0.9,
        metalness: 0.1
     }); 
    const mesh = new THREE.Mesh(geometry, material);

    // Position the mesh
    mesh.position.x = (Math.random() - 0.5) * (ROAD_WIDTH - size);
    mesh.position.y = roadPlane.position.y + 0.05; // Position slightly *above* road
    mesh.position.z = -500; // Start far away

    // Rotate to lie flat on the road
    mesh.rotation.x = -Math.PI / 2;

    mesh.receiveShadow = true; // Re-enable shadow receiving

    potholeData.mesh = mesh;
    potholes.push(potholeData);
    scene.add(mesh);
}

// Check collision between car model and pothole mesh
function checkCollision(carModel, potholeMesh) {
    if (!carModel || !potholeMesh) return false; 

    const carBox = new THREE.Box3().setFromObject(carModel);
    const potholeBox = new THREE.Box3().setFromObject(potholeMesh);

    return carBox.intersectsBox(potholeBox);
}

// Shake effect - calculates offset
function updateShake() {
    if (car.isShaking) {
        car.shakeDuration--;
        if (car.shakeDuration <= 0) {
            car.isShaking = false;
            car.shakeOffset = 0;
            if (carMesh) {
                carMesh.position.x = car.baseX; // Reset to base position when shake ends
            }
        } else {
            // Make shake magnitude dependent on the initial cause
            const magnitude = 2.0 * car.shakeMagnitude;
            car.shakeOffset = Math.sin(car.shakeDuration * 1.2) * magnitude;
        }
    } else {
        car.shakeOffset = 0; // Ensure offset is 0 if not shaking
    }
    // Apply the offset
    if (carMesh) {
        // Apply shake offset relative to the current base position
        carMesh.position.x = car.baseX + car.shakeOffset;
    }
}

// Add new function to create trees
function createTree(side) {
    const minHeight = 12; // Reduced height for better proportion
    const maxHeight = 20;
    const trunkHeight = minHeight + Math.random() * (maxHeight - minHeight);
    const leafHeight = trunkHeight * 0.8; // Leaves shorter than trunk for more realistic look
    const trunkRadius = 0.8 + Math.random() * 0.4; // Variable trunk thickness
    const leafRadius = trunkRadius * 2.5 + Math.random() * 2; // Leaf size based on trunk

    // Create Tree Group
    const treeGroup = new THREE.Group();

    // Create Trunk Mesh - using cylinder for more realistic tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.1, trunkHeight, 8);
    // Add natural color variation to trunks (browns)
    const trunkColors = [0x5D4037, 0x6D4C41, 0x4E342E, 0x795548, 0x3E2723];
    const trunkColor = trunkColors[Math.floor(Math.random() * trunkColors.length)];
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.9, metalness: 0.0 }); 
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    // Position trunk so its bottom is at the group's origin (y=0)
    trunkMesh.position.y = trunkHeight / 2; 
    treeGroup.add(trunkMesh);

    // Create Leaves Mesh - sphere for rounded autumn tree shape
    const leavesGeometry = new THREE.SphereGeometry(leafRadius, 8, 7);
    // Autumn foliage colors to match the park HDRI background
    const leafColors = [0xD4730A, 0xC8860E, 0xB8621C, 0xE8A020, 0x8B5E1A, 0xA0522D, 0xCD853F];
    const leafColor = leafColors[Math.floor(Math.random() * leafColors.length)];
    const leavesMaterial = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, metalness: 0.0 }); 
    const leavesMesh = new THREE.Mesh(leavesGeometry, leavesMaterial);
    // Position sphere so it sits on top of the trunk with slight overlap
    leavesMesh.position.y = trunkHeight + leafRadius * 0.6; 
    treeGroup.add(leavesMesh);

    // Position the entire group with more natural variation
    const baseDistance = ROAD_WIDTH / 2 + 8; // Base distance from road edge
    const randomOffset = Math.random() * 25; // More variation in distance
    const sideOffset = baseDistance + randomOffset;
    treeGroup.position.x = side === 'left' ? -sideOffset : sideOffset;
    
    // Add slight random rotation to avoid uniform appearance
    treeGroup.rotation.y = (Math.random() - 0.5) * 0.5; // Small random Y rotation
    
    // Align group's origin (base of the trunk) precisely with road plane Y
    treeGroup.position.y = roadPlane.position.y - 0.2; 
    treeGroup.position.z = -500; // Start far away

    // Add group to scene and store reference
    scene.add(treeGroup);
    const treeData = { mesh: treeGroup }; // Store the group

    if (side === 'left') {
        trees.left.push(treeData);
    } else {
        trees.right.push(treeData);
    }

    // Enable shadow casting for tree parts
    trunkMesh.castShadow = true;
    leavesMesh.castShadow = true;
}

// --- Update Car Physics and Position ---
function updateCar() {
    if (!carMesh) return;

    // Tapered acceleration: fast off the line, smooth near max speed
    if (keys.w) {
        const speedRatio = car.velocityZ / MAX_SPEED;
        const taperFactor = 1 - speedRatio * 0.85; // Still accelerates at top but gently
        car.velocityZ += FORWARD_ACCELERATION * taperFactor;
        if (car.velocityZ > MAX_SPEED) car.velocityZ = MAX_SPEED;
    } else if (keys.s) {
        // Braking
        car.velocityZ -= BRAKING_FORCE;
        car.velocityZ *= STOPPING_FRICTION;
    } else {
        // No keys - apply friction
        car.velocityZ *= FORWARD_FRICTION;
    }
    
    // Ensure velocity stays in valid range
    car.velocityZ = Math.max(0, car.velocityZ);
    
    // Snap to zero if very small and not accelerating
    if (!keys.w && car.velocityZ < 0.01) {
        car.velocityZ = 0;
    }

    // Lateral Movement - speed-dependent: harder to snap direction at high speed
    const speedFactor = 1 - (car.velocityZ / MAX_SPEED) * 0.35; // Steering tightens at speed
    const healthFactor = (0.5 + (car.health / 200));
    const currentLateralAcceleration = BASE_TURN_ACCELERATION * healthFactor * speedFactor;
    const currentMaxLateralSpeed = BASE_MAX_TURN_SPEED * healthFactor;
    let appliedLateralFriction = FRICTION;
    if (!keys.ArrowLeft && !keys.ArrowRight && Math.abs(car.velocityX) > 0.01) {
        appliedLateralFriction = STOPPING_FRICTION;
    }
    car.velocityX *= appliedLateralFriction;
    if (keys.ArrowLeft) {
        car.velocityX -= currentLateralAcceleration;
    }
    if (keys.ArrowRight) {
        car.velocityX += currentLateralAcceleration;
    }
    car.velocityX = Math.max(-currentMaxLateralSpeed, Math.min(currentMaxLateralSpeed, car.velocityX));
    if (!keys.ArrowLeft && !keys.ArrowRight && Math.abs(car.velocityX) < 0.01) {
        car.velocityX = 0;
    }
    car.baseX += car.velocityX;

    // Visual tilt and yaw when turning
    if (carMesh) {
        const targetTilt = -car.velocityX * 0.08;
        carMesh.rotation.z = carMesh.rotation.z + (targetTilt - carMesh.rotation.z) * 0.15;
        // Slight nose yaw toward turn direction
        const targetYaw = Math.PI + car.velocityX * 0.06;
        carMesh.rotation.y = carMesh.rotation.y + (targetYaw - carMesh.rotation.y) * 0.1;
    }

    // Boundary checks - use cached width, only recalculate once after load
    if (!cachedCarWidth) {
        cachedCarWidth = new THREE.Box3().setFromObject(carMesh).getSize(new THREE.Vector3()).x;
    }
    const carWidth = cachedCarWidth;
    const leftBoundary = -ROAD_WIDTH / 2 + carWidth / 2;
    const rightBoundary = ROAD_WIDTH / 2 - carWidth / 2;
    if (car.baseX < leftBoundary) {
        car.baseX = leftBoundary;
        car.velocityX = 0;
    }
    if (car.baseX > rightBoundary) {
        car.baseX = rightBoundary;
        car.velocityX = 0;
    }

    updateShake();
}

// --- Update Trees ---
function updateTrees(treesArray) {
    for (let i = treesArray.length - 1; i >= 0; i--) {
        const tree = treesArray[i]; // This is treeData object
        if (!tree || !tree.mesh) continue;

        // Move tree group towards camera at the same speed as other objects
        tree.mesh.position.z += car.velocityZ;

        // Remove off-screen trees
        if (tree.mesh.position.z > camera.position.z) {
            scene.remove(tree.mesh); // Remove group from scene
            // Optionally dispose geometries/materials within the group if needed
            // tree.mesh.children.forEach(child => {
            //     if (child.geometry) child.geometry.dispose();
            //     if (child.material) child.material.dispose();
            // });
            treesArray.splice(i, 1); // Remove data object from array
        }
    }
}

// --- Update Potholes ---
function updatePotholes() {
    for (let i = potholes.length - 1; i >= 0; i--) {
        const pothole = potholes[i];
        if (!pothole || !pothole.mesh) continue;

        pothole.mesh.position.z += car.velocityZ;

        // Check collision (pass carMesh, which might be null initially)
        if (!pothole.hit && checkCollision(carMesh, pothole.mesh)) {
            car.health -= pothole.damage;
            healthFill.style.width = `${car.health}%`;
            pothole.hit = true;

            // Change pothole appearance on hit
            if (pothole.mesh && pothole.mesh.material) {
                pothole.mesh.material.color.setHex(0x444444); // Make it darker/greyer
            }
            
            // Start shake effect
            car.isShaking = true;
            car.shakeDuration = 15 + pothole.damage; 

            if (car.health <= 0) {
                gameOver = true;
                document.getElementById('finalScore').textContent = 'Score: ' + score;
                document.getElementById('gameOverScreen').style.display = 'flex';
                document.getElementById('hud').style.display = 'none';
                return true; // Exit update early
            }
        }

        // Remove off-screen potholes
        // Check if the pothole has moved past the camera's near plane or a certain threshold
        if (pothole.mesh.position.z > camera.position.z) { 
            scene.remove(pothole.mesh); // Remove mesh from scene
            // Dispose geometry/material if needed: 
            // pothole.mesh.geometry.dispose(); 
            // pothole.mesh.material.dispose();
            potholes.splice(i, 1); // Remove data object from array
            if (!pothole.hit) { // Only score if not hit (and not already removed)
                score++; 
            }
        }
    }
    return false; // No game over
}

// --- Update Speed Bumps ---
function updateSpeedBumps() {
    for (let i = speedBumps.length - 1; i >= 0; i--) {
        const bump = speedBumps[i];
        if (!bump || !bump.mesh) continue;

        // Move bump towards camera based on car's speed
        bump.mesh.position.z += car.velocityZ;

        // Check collision
        if (!bump.hit && !bump.safelyCrossed && checkCollision(carMesh, bump.mesh)) {
            
            // IMPORTANT: Make sure we're strictly comparing speed
            const currentSpeed = Math.max(0, car.velocityZ); // Ensure it's never negative
            const isTooFast = currentSpeed > bump.damageThreshold;
            
            if (isTooFast) {
                console.log("Car is going too fast - apply damage");
                console.log("currentSpeed:", currentSpeed);
                console.log("velocityZ  :", car.velocityZ);
                // Car is going too fast - apply damage
                const speedFactor = (currentSpeed - bump.damageThreshold);
                const damage = Math.ceil(bump.damageAmount * (1 + speedFactor * 0.5)); // Damage scales with excess speed
                
                console.log("Taking damage:", damage, "at speed:", currentSpeed);
                
                car.health -= damage;
                healthFill.style.width = `${Math.max(0, car.health)}%`;
                
                // Start shake effect
                car.isShaking = true;
                car.shakeDuration = 15 + Math.floor(speedFactor * 5);
                car.shakeMagnitude = 0.6 + speedFactor * bump.shakeMagnitudeMultiplier;
                
                // Change appearance to indicate damage
                if (bump.mesh && bump.mesh.material) {
                   bump.mesh.material.color.setHex(0xCC0000); // Bright red for hitting at high speed
                }
                
                bump.hit = true; // Mark as hit to prevent repeated damage

                if (car.health <= 0) {
                    gameOver = true;
                    document.getElementById('finalScore').textContent = 'Score: ' + score;
                    document.getElementById('gameOverScreen').style.display = 'flex';
                    document.getElementById('hud').style.display = 'none';
                    return true; // Indicate game over
                }
                }
            
        }

        // Remove off-screen speed bumps
        if (bump.mesh.position.z > camera.position.z + 10) {
             scene.remove(bump.mesh);
             speedBumps.splice(i, 1);
        }
    }
    return false; // Indicate game not over
}

// --- Update UI ---
function updateUI() {
    // Update Speedometer
    if (speedoElement) {
        // Convert internal velocityZ to a display speed (e.g., MPH/KPH like)
        const displaySpeed = Math.round(car.velocityZ * 40); // Adjust multiplier for feel
        speedoElement.textContent = `Speed: ${displaySpeed}`;
        
    }
    
    // Update Score
    const scoreDisplay = document.getElementById('scoreDisplay');
    if (scoreDisplay) {
        scoreDisplay.textContent = `Score: ${score}`;
    }
}

// Update game state
function update() {
    if (gameOver) return;
    
    updateCar(); // Update car physics directly using the 'keys' state managed by listeners

    // Camera bob based on speed for sense of motion
    const bobFrequency = 0.08;
    const bobAmplitude = 0.15;
    camera.position.y = 25 + Math.sin(Date.now() * bobFrequency * 0.01) * bobAmplitude * (car.velocityZ / MAX_SPEED);

    // Obstacle, Scenery, UI updates
    if (updatePotholes()) return;
    if (updateSpeedBumps()) return;
    updateTrees(trees.left);
    updateTrees(trees.right);
    updateUI();

    // Spawning Logic
    const baseTreeSpawnRate = 0.008;  // More frequent for trees
    const basePotholeSpawnRate = 0.004; // Less frequent for potholes
    const baseSpeedBumpRate = 0.002;  // Even less frequent for speed bumps
    
    // Adjust spawn rates based on speed
    const treeSpawnRate = baseTreeSpawnRate * (1 + car.velocityZ / MAX_SPEED);
    const potholeSpawnRate = basePotholeSpawnRate * (1 + car.velocityZ / MAX_SPEED);
    const speedBumpSpawnRate = baseSpeedBumpRate * (1 + car.velocityZ / MAX_SPEED);

    // Tree spawning
    if (Math.random() < treeSpawnRate) {
        if (trees.left.length < 15) createTree('left');
        if (trees.right.length < 15) createTree('right');
    }

    // Pothole spawning
    if (Math.random() < potholeSpawnRate) {
        if (potholes.length < 10) createPothole();
    }

    // Speed bump spawning
    if (Math.random() < speedBumpSpawnRate) {
        if (speedBumps.length < 2) createSpeedBump();
    }

    // Road Texture Scrolling
    if (roadMaterial && roadMaterial.map) {
        roadMaterial.map.offset.y -= car.velocityZ * 0.015;
        if (roadMaterial.map.offset.y < -1) roadMaterial.map.offset.y += 1;
        if (roadMaterial.normalMap) roadMaterial.normalMap.offset.y = roadMaterial.map.offset.y;
        if (roadMaterial.roughnessMap) roadMaterial.roughnessMap.offset.y = roadMaterial.map.offset.y;
        if (roadMaterial.aoMap) roadMaterial.aoMap.offset.y = roadMaterial.map.offset.y;
    }
}

// Draw game objects (REMOVED - Now handled by THREE.js renderer)
// function draw() { ... }

// Reset game
function resetGame() {
    car.health = 100;
    healthFill.style.width = '100%';
    
    // Remove all existing pothole meshes from the scene before clearing array
    potholes.forEach(pothole => {
        if (pothole.mesh) {
            scene.remove(pothole.mesh);
            // Optional: Dispose geometry and material
            // pothole.mesh.geometry.dispose();
            // pothole.mesh.material.dispose();
        }
    });
    potholes.length = 0; // Clear the array
    
    // Remove all existing speed bumps
    speedBumps.forEach(bump => {
        if (bump.mesh) {
            scene.remove(bump.mesh);
        }
    });
    speedBumps.length = 0; // Clear the array
    
    score = 0;
    cachedCarWidth = null; // Recalculate on next frame
    car.velocityZ = 0; // Reset forward speed
    car.velocityX = 0; // Reset lateral speed
    car.baseX = 0; // Reset base X
    car.isShaking = false;
    car.shakeOffset = 0;
    car.shakeDuration = 0;
    car.shakeMagnitude = 1;
    
    // Remove all existing tree meshes/groups from the scene
    function clearTrees(treesArray) {
        treesArray.forEach(tree => {
            if (tree.mesh) {
                scene.remove(tree.mesh);
                // Optional: Dispose geometry/material
                // tree.mesh.children.forEach(child => {
                //     if (child.geometry) child.geometry.dispose();
                //     if (child.material) child.material.dispose();
                // });
            }
        });
        treesArray.length = 0; // Clear the array
    }
    clearTrees(trees.left);
    clearTrees(trees.right);
}

// --- THREE.JS Setup ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 75, canvas.width / canvas.height, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(canvas.width, canvas.height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding; 
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5; // Increased exposure for better visibility

// Position Camera - Better positioning for visibility
camera.position.z = 70;
camera.position.y = 40;
camera.rotation.x = -Math.PI / 6;

// Add Lighting - Improved visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Increased ambient light
scene.add(ambientLight);
// Brighter directional light for better visibility
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Increased intensity
directionalLight.position.set(0, 30, 20); // Adjusted position
directionalLight.castShadow = true;

// Configure shadow properties (optional, adjust for quality/performance)
directionalLight.shadow.mapSize.width = 1024; 
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
// Adjust shadow camera frustum (important for directional lights)
const shadowCamSize = 100;
directionalLight.shadow.camera.left = -shadowCamSize;
directionalLight.shadow.camera.right = shadowCamSize;
directionalLight.shadow.camera.top = shadowCamSize;
directionalLight.shadow.camera.bottom = -shadowCamSize;

scene.add(directionalLight);
// Optional: Add a helper to visualize the shadow camera
// const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
// scene.add(shadowHelper);

// --- Load Environment Map (HDRI) --- 
const rgbeLoader = new THREE.RGBELoader();
rgbeLoader.load(
    'environment.hdr',
    function(texture) {
        // --- HDRI Loaded Successfully ---
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
        console.log("Environment map loaded.");

        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';

        // --- NOW Load Car Model (Inside HDRI Callback) --- 
        const loader = new THREE.GLTFLoader();
        loader.load(
            'car.glb',
            function (gltf) {
                // --- Car Model Loaded Successfully ---
                carMesh = gltf.scene;
                console.log("Car model loaded successfully.", carMesh);

                // Scale the model
                const desiredHeight = 16; // Reduced from 22 to make car smaller and more visible
                const boundingBox = new THREE.Box3().setFromObject(carMesh);
                const currentSize = boundingBox.getSize(new THREE.Vector3());
                const scaleFactor = desiredHeight / currentSize.y;
                carMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

                // Position the model - closer to camera for better visibility
                carMesh.position.x = 0;
                const scaledBox = new THREE.Box3().setFromObject(carMesh);
                carMesh.position.y = roadPlane.position.y - scaledBox.min.y;
                carMesh.position.z = camera.position.z - 45;

                // Rotate the car 180 degrees to face forward
                carMesh.rotation.y = Math.PI; 

                // Enable shadows and check materials - Enhanced car visibility
                carMesh.traverse(function (node) {
                    if (node.isMesh) {
                        node.castShadow = true;
                        if (node.material) {
                            // Reduce HDRI influence so the car's original colours show through
                            node.material.envMapIntensity = 0.3;
                            node.material.needsUpdate = true;
                        }
                    }
                });

                
                scene.add(carMesh); // Add car AFTER HDRI is ready and car is processed
            },
            // Car progress callback
            function (xhr) {
                console.log(('Car Model ' + (xhr.loaded / xhr.total * 100)) + '% loaded');
            },
            // Car error callback
            function (error) {
                console.error('An error happened loading the car model:', error);
                // Create a simple fallback car
                createFallbackCar();
            }
        );
        // --- End Car Model Loading ---

    }, 
    // HDRI progress callback
    function (xhr) {
        // Update loading progress
        const progressPercent = Math.round((xhr.loaded / xhr.total) * 100);
        document.getElementById('progressBar').style.width = progressPercent + '%';
        document.getElementById('loadingText').textContent = `Loading environment... ${progressPercent}%`;
    },
    // HDRI error callback
    function(error) {
        console.error("Error loading environment map:", error);
        scene.background = new THREE.Color(0x333333); // Fallback background
        // Hide loading screen even on error
        document.getElementById('loadingScreen').style.display = 'none';
        // Try to load car anyway without environment
        loadCarWithoutEnvironment();
    }
);
// --- End Load Environment Map ---

// Create Road Plane
const textureLoader = new THREE.TextureLoader();

// Load Diffuse (Color) Texture with error handling
const roadTexture = textureLoader.load(
    'road_diffuse.jpg',
    undefined,
    undefined,
    function (error) {
        console.error('Error loading road diffuse texture:', error);
        // Create a fallback texture
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 64;
        fallbackCanvas.height = 64;
        const ctx = fallbackCanvas.getContext('2d');
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(0, 0, 64, 64);
        roadTexture.image = fallbackCanvas;
        roadTexture.needsUpdate = true;
    }
);
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
// Reduced repetition further to minimize tiling effect
roadTexture.repeat.set(3, 15); 
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
roadTexture.anisotropy = maxAnisotropy;
roadTexture.encoding = THREE.sRGBEncoding;
// Improved filtering to reduce blurry/muddy appearance
roadTexture.minFilter = THREE.LinearFilter;
roadTexture.magFilter = THREE.LinearFilter;

// Load Normal Texture with error handling
const roadNormalMap = textureLoader.load(
    'road_normal.jpg',
    undefined,
    undefined,
    function (error) {
        console.error('Error loading road normal texture:', error);
        // Create a fallback normal map (flat blue)
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 64;
        fallbackCanvas.height = 64;
        const ctx = fallbackCanvas.getContext('2d');
        ctx.fillStyle = '#7f7fff'; // Flat normal
        ctx.fillRect(0, 0, 64, 64);
        roadNormalMap.image = fallbackCanvas;
        roadNormalMap.needsUpdate = true;
    }
);
roadNormalMap.wrapS = THREE.RepeatWrapping;
roadNormalMap.wrapT = THREE.RepeatWrapping;
roadNormalMap.repeat.set(8, 50); // <<< Match repetition
roadNormalMap.anisotropy = maxAnisotropy;
roadNormalMap.minFilter = THREE.LinearMipmapLinearFilter;
roadNormalMap.magFilter = THREE.NearestFilter;           // <<< Changed to NearestFilter

// Load Roughness Texture with error handling
const roadRoughnessMap = textureLoader.load(
    'road_roughness.jpg',
    undefined,
    undefined,
    function (error) {
        console.error('Error loading road roughness texture:', error);
        // Create a fallback roughness map (medium gray)
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 64;
        fallbackCanvas.height = 64;
        const ctx = fallbackCanvas.getContext('2d');
        ctx.fillStyle = '#808080'; // 50% gray
        ctx.fillRect(0, 0, 64, 64);
        roadRoughnessMap.image = fallbackCanvas;
        roadRoughnessMap.needsUpdate = true;
    }
);
roadRoughnessMap.wrapS = THREE.RepeatWrapping;
roadRoughnessMap.wrapT = THREE.RepeatWrapping;
roadRoughnessMap.repeat.set(8, 50); // <<< Match repetition
roadRoughnessMap.anisotropy = maxAnisotropy;
roadRoughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
roadRoughnessMap.magFilter = THREE.NearestFilter;           // <<< Changed to NearestFilter

// --- Load AO MAP ---
const roadAoMap = textureLoader.load(
    'road_ao.jpg',
    undefined,
    undefined,
    function (error) {
        console.error('Error loading road AO texture:', error);
        // Create a fallback AO map (white = no occlusion)
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = 64;
        fallbackCanvas.height = 64;
        const ctx = fallbackCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // White = no ambient occlusion
        ctx.fillRect(0, 0, 64, 64);
        roadAoMap.image = fallbackCanvas;
        roadAoMap.needsUpdate = true;
    }
);
roadAoMap.wrapS = THREE.RepeatWrapping;
roadAoMap.wrapT = THREE.RepeatWrapping;
roadAoMap.repeat.set(8, 50); // <<< Match repetition
roadAoMap.anisotropy = maxAnisotropy;
roadAoMap.minFilter = THREE.LinearMipmapLinearFilter;
roadAoMap.magFilter = THREE.NearestFilter;           // <<< Changed to NearestFilter

const roadGeometry = new THREE.PlaneGeometry(ROAD_WIDTH, 1000);
roadGeometry.setAttribute('uv2', new THREE.BufferAttribute(roadGeometry.attributes.uv.array, 2));

// Change to MeshStandardMaterial for consistency with PBR workflow - Improved visibility
const roadMaterial = new THREE.MeshStandardMaterial({
    map: roadTexture,
    normalMap: roadNormalMap,
    roughnessMap: roadRoughnessMap,
    aoMap: roadAoMap,
    aoMapIntensity: 0.8,      // Increased from 0.5 for better shadow definition
    color: 0x4a4a4a,          // Darker gray for better contrast
    metalness: 0.0,           // Reduced metalness for more asphalt-like appearance
    normalScale: new THREE.Vector2(0.5, 0.5) // Increased from 0.2 for better bump visibility
});
const roadPlane = new THREE.Mesh(roadGeometry, roadMaterial);
roadPlane.rotation.x = -Math.PI / 2; 
roadPlane.position.y = -20; 
roadPlane.receiveShadow = true; 
scene.add(roadPlane);

// --- END THREE.JS Setup ---

// Game loop
function gameLoop() {
    // Only update game state if not game over
    if (!gameOver) {
        // Store pre-update velocity
        const preUpdateVelocity = car.velocityZ;
        
        update();
        
        // Check if velocity changed dramatically outside updateCar
        if (Math.abs(car.velocityZ - preUpdateVelocity) > 0.5 && keys.w && preUpdateVelocity >= MAX_SPEED - 0.1) {
            console.warn(`Velocity change detected: ${preUpdateVelocity.toFixed(2)} → ${car.velocityZ.toFixed(2)}`);
        }
        
        // Force maintain speed if W is pressed and already at max speed
        if (keys.w && car.velocityZ >= MAX_SPEED - 0.1) {
            car.velocityZ = MAX_SPEED;
        }
    }
    
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// Start game function (called after assets load)
function startGameLoop() {
    console.log(">>> startGameLoop function called! <<<"); // ADDED THIS LOG
    console.log("Starting game loop...");
    // Hide start screen, show HUD and controls
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('controls').style.display = 'block';
    document.getElementById('gameOverScreen').style.display = 'none';
    
    resetGame(); // Ensure clean state on start
    gameOver = false; // Reset game over flag
    gameLoop();
}

// Start game - wait for user to click start button
document.getElementById('startBtn').addEventListener('click', startGameLoop);
document.getElementById('restartBtn').addEventListener('click', function() {
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('controls').style.display = 'block';
    startGameLoop();
});

// Show start screen initially
document.getElementById('startScreen').style.display = 'flex';
document.getElementById('hud').style.display = 'none';
document.getElementById('controls').style.display = 'none';
document.getElementById('gameOverScreen').style.display = 'none';

// Create speed bump function
function createSpeedBump() {
    // Use road width for length (to span the entire road)
    const minWidth = 3;  // Width in driving direction
    const maxWidth = 8;
    const width = minWidth + Math.random() * (maxWidth - minWidth);
    
    const bumpData = {
        size: width,
        damageThreshold: 1.8, // Lowered from 1.8 to better match new acceleration
        damageAmount: Math.ceil(width * 1.5),
        shakeMagnitudeMultiplier: 0.2,
        hit: false,
        safelyCrossed: false, // Track if the bump was safely crossed
        mesh: null
    };
    
    // Create 3D mesh for the speed bump
    // Note: swapping width and length for proper orientation
    const geometry = new THREE.BoxGeometry(ROAD_WIDTH, 1.5, width);
    const material = new THREE.MeshStandardMaterial({
        map: roadTexture,
        color: 0xFF4500, // Bright orange-red for better visibility
        roughness: 0.8,
        metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the mesh - centered on X (across full road)
    mesh.position.x = 0;
    mesh.position.y = roadPlane.position.y + 0.8; // Position above road surface
    mesh.position.z = -500; // Start far away
    
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    bumpData.mesh = mesh;
    speedBumps.push(bumpData);
    scene.add(mesh);
    
    return bumpData;
} 