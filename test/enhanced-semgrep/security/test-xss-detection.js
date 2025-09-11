
        // 测试XSS
        const userInput = req.query.name;
        document.getElementById('output').innerHTML = userInput;
      