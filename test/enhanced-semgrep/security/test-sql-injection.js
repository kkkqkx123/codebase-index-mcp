
        // 测试SQL注入
        const userId = req.params.id;
        const query = "SELECT * FROM users WHERE id = '" + userId + "'";
        db.query(query);
      