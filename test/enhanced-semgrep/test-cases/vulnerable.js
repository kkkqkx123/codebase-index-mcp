// 测试用例：包含各种漏洞的代码

// 1. SQL注入漏洞
function getUserData(userId) {
    const query = "SELECT * FROM users WHERE id = '" + userId + "'";
    return db.query(query);
}

// 2. XSS漏洞
function displayUserName(name) {
    document.getElementById('username').innerHTML = name;
}

// 3. 命令注入
function executeCommand(cmd) {
    return exec(cmd);
}

// 4. 路径遍历
function readFile(filename) {
    return fs.readFileSync('/uploads/' + filename);
}

// 5. 复杂嵌套条件
function complexLogic(x, y, z) {
    if (x > 0) {
        if (y < 10) {
            if (z > 5) {
                if (x + y > z) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 6. 不可达代码
function unreachableCode(flag) {
    if (flag) {
        return "early";
    }
    console.log("This will never execute");
    return "late";
}

// 7. Switch缺少break
function switchFallthrough(value) {
    switch (value) {
        case 1:
            console.log("one");
        case 2:
            console.log("two");
            break;
        default:
            console.log("other");
    }
}

// 8. 无限递归
function infiniteRecursion(n) {
    return infiniteRecursion(n - 1);
}

// 9. 敏感信息泄露
function logSensitiveData() {
    console.log("User password: " + user.password);
    console.log("Database connection: " + db.connectionString);
}

// 10. 反序列化漏洞
function unsafeDeserialize(data) {
    return JSON.parse(data);
}

module.exports = {
    getUserData,
    displayUserName,
    executeCommand,
    readFile,
    complexLogic,
    unreachableCode,
    switchFallthrough,
    infiniteRecursion,
    logSensitiveData,
    unsafeDeserialize
};