const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const healthFill = document.getElementById('healthFill');

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Add road boundaries constant at the top
const ROAD_LEFT_BOUNDARY = 200;
const ROAD_RIGHT_BOUNDARY = canvas.width - 200;
const ROAD_WIDTH = ROAD_RIGHT_BOUNDARY - ROAD_LEFT_BOUNDARY;

// Add at the top with other constants
const carImage = new Image();
carImage.src = 'Audi.png';
carImage.onload = function() {
    // Calculate proper dimensions maintaining aspect ratio
    const aspectRatio = carImage.naturalWidth / carImage.naturalHeight;
    car.height = 120;  // Set your desired height
    car.width = car.height * aspectRatio;  // Width will adjust based on aspect ratio
};

// Game objects
const car = {
    x: canvas.width / 2 - 30, // Center of road, accounting for car width
    y: canvas.height - 100,
    // width and height will be set after image loads
    baseSpeed: 5,
    baseTurning: 5,
    speed: 5,
    turning: 5,
    health: 100,
    shakeOffset: 0,
    isShaking: false,
    shakeDuration: 0,
    shakeMagnitude: 1
};

const potholes = [];
const trees = {
    left: [],
    right: []
};
let gameSpeed = 3;
let score = 0;

// Game state
let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false
};

// Event listeners
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// Create new pothole
function createPothole() {
    const minSize = 30;
    const maxSize = 60;
    const size = minSize + Math.random() * (maxSize - minSize);
    
    // Generate random irregularity for more realistic shape
    const irregularity = 0.2 + Math.random() * 0.2; // 0.2-0.4
    
    const pothole = {
        // Restrict x position to road area, accounting for pothole size
        x: ROAD_LEFT_BOUNDARY + Math.random() * (ROAD_WIDTH - size),
        y: -size,
        size: size,
        innerRing: size * 0.7,
        damage: Math.ceil(size / 10),
        irregularity: irregularity,
        angle: Math.random() * Math.PI * 2, // Random rotation
        hit: false, // Track if pothole has been hit
        cracks: [] // Will store crack data
    };
    
    // Generate 3-6 cracks radiating from the pothole
    const numCracks = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numCracks; i++) {
        const angle = (i / numCracks) * Math.PI * 2 + Math.random() * 0.5;
        const length = size * (0.7 + Math.random() * 0.5);
        pothole.cracks.push({
            angle: angle,
            length: length,
            width: 1 + Math.random() * 2,
            curve: -0.2 + Math.random() * 0.4
        });
    }
    
    potholes.push(pothole);
}

// Check collision between car and pothole
function checkCollision(car, pothole) {
    if (!car || !pothole) return false;
    
    // Get car hitbox (slightly smaller than the visual car for better gameplay feel)
    const carHitbox = {
        x: car.x + car.width * 0.25,  // Reduce width by 50% (25% from each side)
        y: car.y + car.height * 0.25, // Reduce height by 50% (25% from each side)
        width: car.width * 0.5,       // 50% of original width
        height: car.height * 0.5      // 50% of original height
    };
    
    // Calculate pothole radius (reduced for better gameplay feel)
    const potholeRadius = pothole.size * 0.4; // Use 40% of pothole size as collision radius
    
    // Calculate center points of pothole
    const potholeCenter = {
        x: pothole.x + pothole.size/2,
        y: pothole.y + pothole.size/2
    };
    
    // Calculate closest point on car hitbox to pothole center
    const closestX = Math.max(carHitbox.x, Math.min(potholeCenter.x, carHitbox.x + carHitbox.width));
    const closestY = Math.max(carHitbox.y, Math.min(potholeCenter.y, carHitbox.y + carHitbox.height));
    
    // Calculate distance between closest point and pothole center
    const distanceX = potholeCenter.x - closestX;
    const distanceY = potholeCenter.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    // Check if the distance is less than the pothole radius squared
    return distanceSquared < (potholeRadius * potholeRadius);
}

// Shake effect
function updateShake() {
    if (car.isShaking) {
        car.shakeDuration--;
        if (car.shakeDuration <= 0) {
            car.isShaking = false;
            car.shakeOffset = 0;
        } else {
            car.shakeOffset = Math.sin(car.shakeDuration * 0.5) * 5 * car.shakeMagnitude;
        }
    }
}

// Add new function to create trees
function createTree(side) {
    const minHeight = 80;
    const maxHeight = 120;
    const height = minHeight + Math.random() * (maxHeight - minHeight);
    
    const tree = {
        x: side === 'left' ? 50 + Math.random() * 100 : canvas.width - 150 + Math.random() * 100,
        y: -height,
        height: height,
        width: 20 + Math.random() * 10,
        leafSize: 50 + Math.random() * 20,
        // Random green shade for variation
        color: `rgb(${30 + Math.random() * 20}, ${100 + Math.random() * 30}, ${30 + Math.random() * 20})`
    };
    
    if (side === 'left') {
        trees.left.push(tree);
    } else {
        trees.right.push(tree);
    }
}

// Add tree drawing function
function drawTree(tree) {
    // Draw trunk
    ctx.fillStyle = '#5D4037';  // Brown color for trunk
    ctx.fillRect(tree.x, tree.y + tree.leafSize, tree.width, tree.height - tree.leafSize);
    
    // Draw leaves (triangle shape)
    ctx.beginPath();
    ctx.moveTo(tree.x - tree.leafSize/2, tree.y + tree.leafSize);
    ctx.lineTo(tree.x + tree.width/2, tree.y);
    ctx.lineTo(tree.x + tree.width + tree.leafSize/2, tree.y + tree.leafSize);
    ctx.fillStyle = tree.color;
    ctx.fill();
}

// Update game state
function update() {
    // Update shake effect
    updateShake();
    
    // Update car handling based on health
    car.speed = car.baseSpeed * (0.5 + (car.health / 200)); // At 0 health, speed is 50% of base
    car.turning = car.baseTurning * (0.5 + (car.health / 200)); // At 0 health, turning is 50% of base
    car.shakeMagnitude = 1 + ((100 - car.health) / 25); // Shake more as health decreases

    // Move car with road boundaries
    if (keys.ArrowLeft) {
        car.x = Math.max(ROAD_LEFT_BOUNDARY, car.x - car.turning);
    }
    if (keys.ArrowRight) {
        car.x = Math.min(ROAD_RIGHT_BOUNDARY - car.width, car.x + car.turning);
    }
    if (keys.ArrowUp && car.y > 0) car.y -= car.speed;
    if (keys.ArrowDown && car.y < canvas.height - car.height) car.y += car.speed;

    // Update trees
    function updateTrees(treesArray) {
        for (let i = treesArray.length - 1; i >= 0; i--) {
            treesArray[i].y += gameSpeed * 0.7;  // Trees move slightly slower than road for parallax effect
            if (treesArray[i].y > canvas.height) {
                treesArray.splice(i, 1);
            }
        }
    }
    
    updateTrees(trees.left);
    updateTrees(trees.right);

    // Update potholes
    for (let i = potholes.length - 1; i >= 0; i--) {
        const pothole = potholes[i];
        if (!pothole) continue;

        pothole.y += gameSpeed;
        
        // Check collision
        if (!pothole.hit && checkCollision(car, pothole)) {
            car.health -= pothole.damage;  // Use variable damage
            healthFill.style.width = `${car.health}%`;
            pothole.hit = true; // Mark as hit instead of removing
            
            // Start shake effect - bigger potholes shake more
            car.isShaking = true;
            car.shakeDuration = 15 + pothole.damage;
            
            if (car.health <= 0) {
                alert('Game Over! Score: ' + score);
                resetGame();
                return;
            }
        }
        
        // Remove off-screen potholes
        if (pothole.y > canvas.height) {
            potholes.splice(i, 1);
            if (!pothole.hit) {
                score++; // Only increment score if successfully avoided
            }
        }
    }

    // Create new trees
    if (Math.random() < 0.02) {
        createTree('left');
        createTree('right');
    }

    // Create new potholes
    if (Math.random() < 0.02) {
        createPothole();
    }

    // Modify speed increase to be more gradual
    if (score % 50 === 0 && score > 0) {
        gameSpeed += 0.2;  // Reduced from 0.5 to 0.2
    }
}

// Draw game objects
function draw() {
    // Clear canvas
    ctx.fillStyle = '#666';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grass on sides
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(0, 0, ROAD_LEFT_BOUNDARY, canvas.height);  // Left grass
    ctx.fillRect(ROAD_RIGHT_BOUNDARY, 0, ROAD_LEFT_BOUNDARY, canvas.height);  // Right grass

    // Draw road edges (white lines)
    ctx.fillStyle = '#fff';
    ctx.fillRect(ROAD_LEFT_BOUNDARY - 2, 0, 4, canvas.height);  // Left edge
    ctx.fillRect(ROAD_RIGHT_BOUNDARY - 2, 0, 4, canvas.height);  // Right edge

    // Draw center lines
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.fillRect(canvas.width / 2 - 2, i, 4, 30);
    }

    // Draw trees
    [...trees.left, ...trees.right].forEach(tree => drawTree(tree));

    // Draw car with shake effect
    const carX = car.x + car.shakeOffset;
    ctx.save();  // Save the current context state
    ctx.translate(carX + car.width/2, car.y + car.height/2);  // Move to car center
    
    // Add health-based wobble
    const healthWobble = Math.sin(Date.now() / 200) * ((100 - car.health) / 50);
    
    // Optional: add rotation if you want the car to tilt slightly when moving
    if (keys.ArrowLeft) ctx.rotate(-0.1 - healthWobble * 0.05);
    else if (keys.ArrowRight) ctx.rotate(0.1 + healthWobble * 0.05);
    else ctx.rotate(healthWobble * 0.05); // Slight wobble even when going straight
    
    ctx.drawImage(
        carImage, 
        -car.width/2, -car.height/2,  // Center the image
        car.width, car.height
    );
    ctx.restore();  // Restore the context state

    // Draw potholes
    potholes.forEach(pothole => {
        if (!pothole) return;
        
        const centerX = pothole.x + pothole.size/2;
        const centerY = pothole.y + pothole.size/2;
        
        // Draw cracks first (underneath the pothole)
        ctx.strokeStyle = '#333';
        pothole.cracks.forEach(crack => {
            ctx.beginPath();
            ctx.lineWidth = crack.width;
            
            // Start at the edge of the pothole
            const startX = centerX + Math.cos(crack.angle + pothole.angle) * (pothole.size/2 * 0.9);
            const startY = centerY + Math.sin(crack.angle + pothole.angle) * (pothole.size/2 * 0.9);
            
            ctx.moveTo(startX, startY);
            
            // Create a curved crack
            const controlX = startX + Math.cos(crack.angle + pothole.angle + crack.curve) * (crack.length * 0.5);
            const controlY = startY + Math.sin(crack.angle + pothole.angle + crack.curve) * (crack.length * 0.5);
            
            const endX = startX + Math.cos(crack.angle + pothole.angle) * crack.length;
            const endY = startY + Math.sin(crack.angle + pothole.angle) * crack.length;
            
            ctx.quadraticCurveTo(controlX, controlY, endX, endY);
            ctx.stroke();
        });
        
        // Draw irregular outer edge
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
            const radius = (pothole.size/2) * (1 + Math.sin(angle * 5 + pothole.angle) * pothole.irregularity);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            if (angle === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = pothole.hit ? '#4a4a4a' : '#1a1a1a'; // Lighter color if hit
        ctx.fill();
        
        // Draw irregular inner circle
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
            const radius = (pothole.innerRing/2) * (1 + Math.sin(angle * 4 + pothole.angle) * pothole.irregularity);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            if (angle === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fillStyle = pothole.hit ? '#333333' : '#000000'; // Lighter color if hit
        ctx.fill();
        
        // Add texture and depth effect
        ctx.beginPath();
        ctx.ellipse(
            centerX - 5, 
            centerY - 5, 
            pothole.size/6, 
            pothole.size/8, 
            pothole.angle, 
            0, 
            Math.PI * 2
        );
        ctx.fillStyle = pothole.hit ? 'rgba(50, 50, 50, 0.6)' : 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        
        // Add a subtle shadow
        ctx.beginPath();
        ctx.ellipse(
            centerX + 2,
            centerY + 3,
            pothole.size/2 + 4,
            pothole.size/2 + 2,
            pothole.angle,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
    });

    // Draw score
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 20, 40);
}

// Reset game
function resetGame() {
    car.health = 100;
    healthFill.style.width = '100%';
    potholes.length = 0;
    score = 0;
    gameSpeed = 3;
    car.x = canvas.width / 2 - car.width / 2;  // Center of road
    car.y = canvas.height - 100;
    car.isShaking = false;
    car.shakeOffset = 0;
    car.shakeDuration = 0;
    car.speed = car.baseSpeed;
    car.turning = car.baseTurning;
    car.shakeMagnitude = 1;
    trees.left = [];
    trees.right = [];
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
gameLoop(); 