import { createClient } from '@nebula-contrib/nebula-nodejs';
import { ConfigService } from '../../../config/ConfigService';

async function testNebulaConnection() {
  try {
    // 获取配置
    const configService = ConfigService.getInstance();
    const config = configService.getAll();
    
    console.log('Nebula配置信息:');
    console.log(`Host: ${config.nebula.host}`);
    console.log(`Port: ${config.nebula.port}`);
    console.log(`Username: ${config.nebula.username}`);
    console.log(`Space: ${config.nebula.space}`);
    
    // 创建客户端连接（不指定space参数）
    const options: any = {
      servers: [`${config.nebula.host}:${config.nebula.port}`],
      userName: config.nebula.username,
      password: config.nebula.password
      // 不在连接时指定space参数
    };
    
    console.log('\n正在连接到Nebula Graph...');
    const client: any = createClient(options);
    
    // 监听连接事件
    client.on('ready', async () => {
      console.log('连接成功!');
      
      try {
        // 等待连接准备就绪
          await new Promise<void>((resolve, reject) => {
            const readyHandler = () => {
              console.log('连接已准备就绪');
              client.off('error', errorHandler);
              resolve();
            };

            const errorHandler = (error: any) => {
              console.error('连接错误:', error);
              client.off('ready', readyHandler);
              reject(error);
            };

            client.on('ready', readyHandler);
            client.on('error', errorHandler);
          });

        console.log('已成功连接到Nebula Graph');

        // 首先创建配置中指定的space（如果不存在）
        console.log(`\n创建space: ${config.nebula.space}`);
        try {
          await client.execute(`CREATE SPACE IF NOT EXISTS ${config.nebula.space} (vid_type=FIXED_STRING(32))`);
          // 等待space创建完成
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // 切换到配置中指定的space
          console.log(`\n切换到space: ${config.nebula.space}`);
          await client.execute(`USE ${config.nebula.space}`);
          console.log(`已切换到space: ${config.nebula.space}`);
        } catch (error) {
          console.error('创建或切换space时出错:', error);
          // 如果创建配置中指定的space失败，尝试使用默认space
          try {
            console.log('\n尝试使用默认space: codegraph');
            await client.execute('USE codegraph');
            console.log('已切换到默认space: codegraph');
          } catch (defaultSpaceError) {
            console.error('使用默认space时出错:', defaultSpaceError);
            throw error; // 仍然抛出原始错误
          }
        }

        // 查看当前存在的space列表
        console.log('\n查看当前存在的space列表:');
        try {
          const showSpacesResult = await client.execute('SHOW SPACES');
          console.log('Space列表:', showSpacesResult);
        } catch (error) {
          console.error('查看space列表时出错:', error);
        }
        
        // 使用配置中指定的space名称作为测试space
        const testSpaceName = config.nebula.space;
        console.log(`\n使用space进行测试: ${testSpaceName}`);
        
        // 在新space中创建一个标签
        console.log('\n在新space中创建标签:');
        const createTagResult = await client.execute(
          'CREATE TAG IF NOT EXISTS test_tag(name string, created datetime)'
        );
        console.log('创建标签结果:', createTagResult);
        
        // 验证space是否创建成功
        console.log('\n验证space列表:');
        const showSpacesResult = await client.execute('SHOW SPACES');
        console.log('Space列表:', showSpacesResult);
        
        // 删除新创建的space
        console.log(`\n正在删除space: ${testSpaceName}`);
        const dropSpaceResult = await client.execute(`DROP SPACE IF EXISTS ${testSpaceName}`);
        console.log(`删除space结果:`, dropSpaceResult);
        
        console.log('\n测试完成!');
        process.exit(0);
      } catch (error) {
        console.error('操作过程中发生错误:', error);
        process.exit(1);
      }
    });
    
    client.on('error', ({ error }: { error: any }) => {
      console.error('连接错误:', error);
      process.exit(1);
    });
    
    // 设置连接超时
    setTimeout(() => {
      console.error('连接超时');
      process.exit(1);
    }, 15000);
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 执行测试
testNebulaConnection();