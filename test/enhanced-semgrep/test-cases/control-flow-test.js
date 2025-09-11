// 控制流分析规则测试用例

// 1. 复杂嵌套条件测试
function complexNestedConditions() {
    if (user.isActive) {
        if (user.hasPermission) {
            if (user.isAdmin) {
                if (user.canDelete) {
                    return true;
                }
            }
        }
    }
    return false;
}

// 2. 循环不变代码测试
function loopInvariantCode() {
    const constant = 100;
    const results = [];
    
    for (let i = 0; i < 10; i++) {
        const multiplier = 2; // 循环不变代码
        results.push(i * constant * multiplier);
    }
    
    return results;
}

// 3. 空循环体测试
function emptyLoopBody() {
    let i = 0;
    while (i < 10) {
        // 空循环体 - 潜在bug
    }
}

// 4. 异常处理测试
function exceptionHandling() {
    try {
        const file = openFile('test.txt');
        const data = file.read();
        return data;
    } catch (error) {
        // 异常被吞噬
    }
}

// 5. 资源泄漏测试
function resourceLeak() {
    const file = openFile('test.txt');
    const data = file.read();
    // 文件句柄未关闭
    return data;
}

// 6. 循环边界错误测试
function offByOneError() {
    const arr = [1, 2, 3, 4, 5];
    
    // off-by-one错误
    for (let i = 0; i <= arr.length; i++) {
        console.log(arr[i]);
    }
}

// 7. 异常处理中的返回测试
function returnInFinally() {
    try {
        riskyOperation();
    } catch (error) {
        handleError(error);
    } finally {
        return "completed"; // 可能抑制异常
    }
}

// 8. 不必要的循环创建
function unnecessaryLoop() {
    const numbers = [1, 2, 3, 4, 5];
    const evens = [];
    
    // 可以用filter替代
    for (let num of numbers) {
        if (num % 2 === 0) {
            evens.push(num);
        }
    }
    
    return evens;
}

// 辅助函数
function openFile(filename) {
    return { read: () => "file content" };
}

function riskyOperation() {
    throw new Error("Something went wrong");
}

function handleError(error) {
    console.error(error);
}