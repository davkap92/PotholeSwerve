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
    speed: 5,
    health: 100,
    shakeOffset: 0,
    isShaking: false,
    shakeDuration: 0
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
    
    const pothole = {
        // Restrict x position to road area, accounting for pothole size
        x: ROAD_LEFT_BOUNDARY + Math.random() * (ROAD_WIDTH - size),
        y: -size,
        size: size,
        innerRing: size * 0.7,
        damage: Math.ceil(size / 10)
    };
    potholes.push(pothole);
}

// Check collision between car and pothole
function checkCollision(car, pothole) {
    if (!car || !pothole) return false;
    
    // Calculate center points of pothole
    const potholeCenter = {
        x: pothole.x + pothole.size/2,
        y: pothole.y + pothole.size/2
    };
    
    // Calculate closest point on car to pothole center
    const closestX = Math.max(car.x, Math.min(potholeCenter.x, car.x + car.width));
    const closestY = Math.max(car.y, Math.min(potholeCenter.y, car.y + car.height));
    
    // Calculate distance between closest point and pothole center
    const distanceX = potholeCenter.x - closestX;
    const distanceY = potholeCenter.y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    return distanceSquared < (pothole.size/2 * pothole.size/2);
}

// Shake effect
function updateShake() {
    if (car.isShaking) {
        car.shakeDuration--;
        if (car.shakeDuration <= 0) {
            car.isShaking = false;
            car.shakeOffset = 0;
        } else {
            car.shakeOffset = Math.sin(car.shakeDuration * 0.5) * 5;
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

    // Move car with road boundaries
    if (keys.ArrowLeft) {
        car.x = Math.max(ROAD_LEFT_BOUNDARY, car.x - car.speed);
    }
    if (keys.ArrowRight) {
        car.x = Math.min(ROAD_RIGHT_BOUNDARY - car.width, car.x + car.speed);
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
        if (checkCollision(car, pothole)) {
            car.health -= pothole.damage;  // Use variable damage
            healthFill.style.width = `${car.health}%`;
            potholes.splice(i, 1);
            
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
            score++;
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
    // Optional: add rotation if you want the car to tilt slightly when moving
    if (keys.ArrowLeft) ctx.rotate(-0.1);
    if (keys.ArrowRight) ctx.rotate(0.1);
    ctx.drawImage(
        carImage, 
        -car.width/2, -car.height/2,  // Center the image
        car.width, car.height
    );
    ctx.restore();  // Restore the context state

    // Draw potholes
    potholes.forEach(pothole => {
        if (!pothole) return;
        
        // Draw outer circle
        ctx.beginPath();
        ctx.arc(pothole.x + pothole.size/2, pothole.y + pothole.size/2, 
                pothole.size/2, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        
        // Draw inner circle
        ctx.beginPath();
        ctx.arc(pothole.x + pothole.size/2, pothole.y + pothole.size/2, 
                pothole.innerRing/2, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        
        // Add depth effect
        ctx.beginPath();
        ctx.arc(pothole.x + pothole.size/2 - 5, pothole.y + pothole.size/2 - 5, 
                pothole.size/6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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