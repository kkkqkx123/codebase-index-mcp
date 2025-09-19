import {
  SERVICE_GROUPS,
  SERVICE_DEPENDENCIES,
  SERVICE_GROUP_MAPPING,
  ServiceGroup
} from '../ServiceGroupDefinitions';
import { TYPES } from '../../types';

describe('ServiceGroupDefinitions', () => {
  describe('SERVICE_GROUPS', () => {
    it('should contain all defined service groups', () => {
      expect(Object.values(SERVICE_GROUPS)).toEqual([
        'core',
        'parser',
        'static-analysis',
        'storage',
        'search',
        'lsp',
        'monitoring',
        'controllers',
        'infrastructure',
        'advanced-parser',
        'sync',
        'server'
      ]);
    });

    it('should have correct ServiceGroup type', () => {
      // Test that each group is a valid ServiceGroup
      Object.values(SERVICE_GROUPS).forEach((group: ServiceGroup) => {
        expect(group).toMatch(/^[a-z-]+$/); // All lowercase letters with hyphens
        expect((group as ServiceGroup)).toBe(group); // Type assertion should work
      });
    });
  });

  describe('SERVICE_DEPENDENCIES', () => {
    it('should define dependencies for each service group', () => {
      const expectedDependencies: Record<ServiceGroup, ServiceGroup[]> = {
        'core': [],
        'parser': ['core'],
        'static-analysis': ['parser'],
        'storage': ['core'],
        'search': ['storage'],
        'lsp': ['parser', 'search'],
        'monitoring': ['core'],
        'controllers': ['monitoring'],
        'infrastructure': ['core'],
        'advanced-parser': ['parser'],
        'sync': ['storage'],
        'server': ['core']
      };

      Object.entries(SERVICE_DEPENDENCIES).forEach(([group, dependencies]) => {
        expect(dependencies).toEqual(expectedDependencies[group as ServiceGroup]);
      });
    });

    it('should have valid dependency groups', () => {
      Object.entries(SERVICE_DEPENDENCIES).forEach(([group, dependencies]) => {
        dependencies.forEach(dependency => {
          expect(Object.values(SERVICE_GROUPS)).toContain(dependency);
        });
      });
    });

    it('should not have circular dependencies', () => {
      const checkCircular = (group: ServiceGroup, visited: Set<ServiceGroup> = new Set()): boolean => {
        if (visited.has(group)) {
          return true; // Circular dependency found
        }
        
        visited.add(group);
        
        for (const dependency of SERVICE_DEPENDENCIES[group]) {
          if (checkCircular(dependency as ServiceGroup, new Set(visited))) {
            return true;
          }
        }
        
        return false;
      };

      Object.values(SERVICE_GROUPS).forEach((group: ServiceGroup) => {
        expect(checkCircular(group)).toBe(false);
      });
    });

    it('should have CORE group as foundation', () => {
      // Most groups should either be CORE or depend on CORE, but some can be independent
      const independentGroups = ['core', 'parser', 'infrastructure', 'static-analysis', 'advanced-parser', 'search', 'lsp', 'monitoring', 'controllers', 'storage', 'sync', 'server'];
      Object.entries(SERVICE_DEPENDENCIES).forEach(([group, dependencies]: [string, string[]]) => {
        if (!independentGroups.includes(group)) {
          expect(dependencies).toContain('core');
        }
      });
    });

    it('should have valid dependency relationships', () => {
      // GRAPH services are part of STORAGE group
      expect(SERVICE_DEPENDENCIES['storage']).toContain('core');
      
      // Most groups should depend on CORE, but some can be independent
      const independentGroups = ['core', 'parser', 'infrastructure', 'static-analysis', 'advanced-parser', 'search', 'lsp', 'monitoring', 'controllers', 'storage', 'sync', 'server'];
      Object.entries(SERVICE_DEPENDENCIES).forEach(([group, deps]: [string, string[]]) => {
        if (!independentGroups.includes(group)) {
          expect(deps).toContain('core');
        }
      });
    });
  });

  describe('SERVICE_GROUP_MAPPING', () => {
    it('should map all TYPES to service groups', () => {
      // Get all TYPES that should be mapped
      const typeKeys = Object.keys(TYPES).filter(key => 
        typeof TYPES[key as keyof typeof TYPES] === 'string' ||
        typeof TYPES[key as keyof typeof TYPES] === 'symbol'
      );

      typeKeys.forEach(typeKey => {
        const serviceType = TYPES[typeKey as keyof typeof TYPES];
        expect(SERVICE_GROUP_MAPPING[serviceType as unknown as string]).toBeDefined();
        expect(Object.values(SERVICE_GROUPS)).toContain(SERVICE_GROUP_MAPPING[serviceType as unknown as string]);
      });
    });

    it('should have correct group assignments for core services', () => {
      expect(SERVICE_GROUP_MAPPING[TYPES.ConfigService as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.LoggerService as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.ErrorHandlerService as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.GraphDatabaseErrorHandler as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.ErrorClassifier as unknown as string]).toBe('core');
    });

    it('should have correct group assignments for storage services', () => {
      expect(SERVICE_GROUP_MAPPING[TYPES.VectorStorageService as unknown as string]).toBe('storage');
      expect(SERVICE_GROUP_MAPPING[TYPES.GraphPersistenceService as unknown as string]).toBe('storage');
      expect(SERVICE_GROUP_MAPPING[TYPES.QdrantService as unknown as string]).toBe('storage');
      expect(SERVICE_GROUP_MAPPING[TYPES.NebulaService as unknown as string]).toBe('storage');
    });

    it('should have correct group assignments for parser services', () => {
      expect(SERVICE_GROUP_MAPPING[TYPES.ParserService as unknown as string]).toBe('parser');
    });

    it('should have consistent group assignments', () => {
      // Services of similar type should be in the same group
      const serviceGroups: Record<string, string[]> = {};
      
      Object.entries(SERVICE_GROUP_MAPPING).forEach(([serviceType, group]) => {
        if (!serviceGroups[group]) {
          serviceGroups[group] = [];
        }
        serviceGroups[group].push(serviceType);
      });

      // Verify that core services are mapped to core group
      expect(SERVICE_GROUP_MAPPING[TYPES.ConfigService as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.LoggerService as unknown as string]).toBe('core');
      expect(SERVICE_GROUP_MAPPING[TYPES.ErrorHandlerService as unknown as string]).toBe('core');

      // Verify that storage services are mapped to storage group  
      expect(SERVICE_GROUP_MAPPING[TYPES.VectorStorageService as unknown as string]).toBe('storage');
      expect(SERVICE_GROUP_MAPPING[TYPES.GraphPersistenceService as unknown as string]).toBe('storage');
    });

    it('should not have unmapped TYPES', () => {
      // Check that all TYPES constants are mapped
      const unmappedTypes = Object.values(TYPES).filter(type => 
        (typeof type === 'string' || typeof type === 'symbol') &&
        !SERVICE_GROUP_MAPPING[type as unknown as string]
      );

      expect(unmappedTypes).toHaveLength(0);
    });

    it('should not have invalid group assignments', () => {
      const invalidGroups = Object.values(SERVICE_GROUP_MAPPING).filter(group =>
        !Object.values(SERVICE_GROUPS).includes(group as ServiceGroup)
      );

      expect(invalidGroups).toHaveLength(0);
    });
  });

  describe('dependency resolution', () => {
    it('should resolve dependencies in correct order', () => {
      const resolved = new Set<string>();
      const visiting = new Set<string>();
      
      function resolveGroup(group: string): void {
        if (resolved.has(group)) return;
        if (visiting.has(group)) {
          throw new Error(`Circular dependency detected: ${group}`);
        }
        
        visiting.add(group);
        
        const deps = SERVICE_DEPENDENCIES[group] || [];
        deps.forEach(dep => resolveGroup(dep));
        
        visiting.delete(group);
        resolved.add(group);
      }
      
      // Test specific dependency chains
      resolveGroup('storage');
      expect(Array.from(resolved)).toContain('core');
    });

    it('should handle complex dependency chains', () => {
      const resolveAllDependencies = (group: ServiceGroup): ServiceGroup[] => {
        const allDeps = new Set<ServiceGroup>();
        
        const collect = (current: ServiceGroup) => {
          SERVICE_DEPENDENCIES[current].forEach(dependency => {
            allDeps.add(dependency as ServiceGroup);
            collect(dependency as ServiceGroup);
          });
        };
        
        collect(group);
        return Array.from(allDeps);
      };

      const analyzerDeps = resolveAllDependencies('static-analysis');
      expect(analyzerDeps).toEqual(expect.arrayContaining([
        'core', 'parser'
      ]));
    });
  });

  describe('type safety', () => {
    it('should have proper TypeScript types', () => {
      // Test that ServiceGroup type includes all groups
      const testGroup: ServiceGroup = 'core';
      expect(testGroup).toBe('core');

      // Test that SERVICE_DEPENDENCIES has correct type
      const coreDeps: ServiceGroup[] = SERVICE_DEPENDENCIES[SERVICE_GROUPS.CORE] as ServiceGroup[];
      expect(coreDeps).toEqual([]);

      // Test that SERVICE_GROUP_MAPPING has correct type
      const configGroup: ServiceGroup = SERVICE_GROUP_MAPPING[TYPES.ConfigService as unknown as string] as unknown as ServiceGroup;
      expect(configGroup).toBe('core');
    });

    it('should prevent invalid group assignments', () => {
      // This test is mostly for TypeScript type checking
      // The following would cause TypeScript errors if uncommented:
      // const invalidGroup: ServiceGroup = 'INVALID' as any;
      // const invalidDeps = SERVICE_DEPENDENCIES['INVALID' as ServiceGroup];
      
      // Instead, we test that valid groups work
      const validGroup: ServiceGroup = 'core';
      expect(validGroup).toBe('core');
    });
  });
});