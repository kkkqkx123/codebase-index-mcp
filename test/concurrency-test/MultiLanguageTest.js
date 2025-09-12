class Counter {
    constructor() {
        this.counter = 0;
    }
    
    increment() {
        this.counter = this.counter + 1; // Race condition
    }
}

class SharedData {
    constructor() {
        this.data = new Map();
    }
    
    addData(key, value) {
        this.data.set(key, value); // Race condition
    }
}

let globalVar = 0;

function worker() {
    globalVar = globalVar + 1; // Race condition
}

async function asyncTask() {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Potential race condition
}

function createThread() {
    new Promise((resolve) => {
        globalVar = globalVar + 1; // Race condition
        resolve();
    });
}

const fs = require('fs');
function fileAccess() {
    fs.writeFileSync('test.txt', 'test'); // Race condition
}

module.exports = { Counter, SharedData };