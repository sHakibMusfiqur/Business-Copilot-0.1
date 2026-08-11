import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

describe('RbacController RBAC read authorization (Finding 8-1)', () => {
  let controller: RbacController;

  beforeEach(() => {
    controller = new RbacController({} as unknown as RbacService);
  });

  const requirement = (method: unknown) =>
    Reflect.getMetadata(PERMISSIONS_KEY, method as object);

  describe('sensitive read endpoints require organization.manage', () => {
    it.each([
      ['getPermissions', 'GET /permissions'],
      ['getPermissionsGrouped', 'GET /permissions/grouped'],
      ['getRoles', 'GET /roles'],
      ['getRolePermissions', 'GET /roles/:id/permissions'],
      ['getUserRoles', 'GET /users/:id/roles'],
    ])('%s (%s) is gated by organization.manage', (methodName) => {
      expect(requirement(controller[methodName as keyof RbacController])).toEqual({
        permissions: ['organization.manage'],
        mode: 'AND',
      });
    });
  });

  describe('/permissions/me stays available to any authenticated user', () => {
    it('does not require organization.manage', () => {
      expect(requirement(controller.getMyPermissions)).toBeUndefined();
    });
  });
});