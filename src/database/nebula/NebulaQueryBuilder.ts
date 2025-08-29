import { injectable } from 'inversify';

@injectable()
export class NebulaQueryBuilder {
  /**
   * 构建INSERT VERTEX语句
   * @param tag 标签名称
   * @param vertexId 顶点ID
   * @param properties 属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  insertVertex(tag: string, vertexId: string, properties: Record<string, any>): { query: string, params: Record<string, any> } {
    // 获取属性键
    const propertyKeys = Object.keys(properties);
    
    // 如果没有属性，构建简单的INSERT语句
    if (propertyKeys.length === 0) {
      const query = `INSERT VERTEX ${tag}() VALUES ${vertexId}:()`;
      return { query, params: {} };
    }
    
    // 构建属性名列表
    const propertyNames = propertyKeys.join(', ');
    
    // 构建参数占位符
    const paramPlaceholders = propertyKeys.map((_, index) => `$param${index}`).join(', ');
    
    // 构建查询语句
    const query = `INSERT VERTEX ${tag}(${propertyNames}) VALUES ${vertexId}:(${paramPlaceholders})`;
    
    // 构建参数对象
    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`param${index}`] = properties[key];
    });
    
    return { query, params };
  }
  
  /**
   * 构建INSERT EDGE语句
   * @param edgeType 边类型
   * @param srcId 源顶点ID
   * @param dstId 目标顶点ID
   * @param properties 属性对象
   * @returns {query: string, params: Record<string, any>} 查询语句和参数
   */
  insertEdge(edgeType: string, srcId: string, dstId: string, properties: Record<string, any>): { query: string, params: Record<string, any> } {
    // 获取属性键
    const propertyKeys = Object.keys(properties);
    
    // 如果没有属性，构建简单的INSERT语句
    if (propertyKeys.length === 0) {
      const query = `INSERT EDGE ${edgeType}() VALUES ${srcId}->${dstId}:()`;
      return { query, params: {} };
    }
    
    // 构建属性名列表
    const propertyNames = propertyKeys.join(', ');
    
    // 构建参数占位符
    const paramPlaceholders = propertyKeys.map((_, index) => `$param${index}`).join(', ');
    
    // 构建查询语句
    const query = `INSERT EDGE ${edgeType}(${propertyNames}) VALUES ${srcId}->${dstId}:(${paramPlaceholders})`;
    
    // 构建参数对象
    const params: Record<string, any> = {};
    propertyKeys.forEach((key, index) => {
      params[`param${index}`] = properties[key];
    });
    
    return { query, params };
  }
  
  /**
   * 构建GO语句
   * @param steps 步数
   * @param vertexId 起始顶点ID
   * @param edgeType 边类型（可选）
   * @param yieldFields 返回字段
   * @returns 查询语句
   */
  go(steps: number, vertexId: string, yieldFields: string, edgeType?: string): string {
    let query = `GO ${steps} STEPS FROM ${vertexId}`;
    
    if (edgeType) {
      query += ` OVER ${edgeType}`;
    }
    
    query += ` YIELD ${yieldFields}`;
    
    return query;
  }
  
  /**
   * 构建MATCH语句
   * @param pattern 匹配模式
   * @param whereClause WHERE子句（可选）
   * @param returnClause RETURN子句
   * @returns 查询语句
   */
  match(pattern: string, returnClause: string, whereClause?: string): string {
    let query = `MATCH ${pattern}`;
    
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    
    query += ` RETURN ${returnClause}`;
    
    return query;
  }
  
  /**
   * 处理参数化查询
   * @param query 查询语句
   * @param params 参数对象
   * @returns 处理后的查询语句和参数
   */
  parameterize(query: string, params: Record<string, any>): { query: string, params: Record<string, any> } {
    // 在nGQL中，参数使用$符号前缀
    // 这个方法可以用于确保参数正确传递
    return { query, params };
  }
}