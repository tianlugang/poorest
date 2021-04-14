import { parseMode } from '../services'
import { IPackageSpec, PackageUtility } from '../storage'
import { IRuntimeUser } from './token'
import { RoleAuth } from './role'

type INamedPackageSpec = IPackageSpec & {
    name: string
}

/**
 * @description
 * mode的构造：使用四位数数字的序列（例如765）。 
 * 最左边的数字（示例中的 7）指定文件所有者的权限。 
 * 中间的数字（示例中的 6）指定群组的权限。 
 * 最右边的数字（示例中的 5）指定其他人的权限。
 */

// Atomics
const OPERATION = {
    cannot: 0,
    canSearch: 1, // serach
    canWrite: 2, // deprecate publish
    canWriteAndSearch: 3,
    canRead: 4, // download
    canReadAndSearch: 5,
    canReadAndWrite: 6,
    canAll: 7
}

// const PACKAGE_STATUS = {
//     deprecated: 0, // 已废弃
//     private: 1, // 私有包，只有拥有者或者其组织内的成员才可以使用
//     protected: 2, // 受保护，只能访问，不能覆盖
//     public: 3, // 任何用户都可以访问
//     anonymous: 4, // 匿名包，被管理员标记
// }

export class PackageControllor {
    parse(mode: string) {
        return {
            owner: parseMode(mode.charAt(0), 8),
            group: parseMode(mode.charAt(1), 8),
            other: parseMode(mode.charAt(2), 8),
        }
    }

    cannot(code: number) {
        return code === OPERATION.cannot
    }

    canSearch(code: number) {
        return code === OPERATION.canSearch
    }

    canWrite(code: number) {
        return code === OPERATION.canWrite
    }

    canWriteAndSearch(code: number) {
        return code === OPERATION.canWriteAndSearch
    }

    canRead(code: number) {
        return code === OPERATION.canRead
    }

    canReadAndSearch(code: number) {
        return code === OPERATION.canReadAndSearch
    }

    canReadAndWrite(code: number) {
        return code === OPERATION.canReadAndWrite
    }

    canAll(code: number) {
        return code === OPERATION.canAll
    }

    canSearchPackage(spec: INamedPackageSpec, user: IRuntimeUser) {
        const role = RoleAuth.parse(user.role)
        const mode = PackageAuth.parse(spec.mode)

        // 超级管理员
        if (RoleAuth.isAdministrator(role.system)) {
            return true
        }

        if (PackageUtility.isScopedPackage(spec.name)) {
            // 分组创建者或管理员
            if (RoleAuth.isTeamOwner(role.team) || RoleAuth.isTeamAdministrator(role.team)) {
                return PackageAuth.canSearch(mode.owner)
            }

            // 分组成员
            if (RoleAuth.isTeamMember(role.team)) {
                return PackageAuth.canSearch(mode.group)
            }

            // 游客或者不在分组内
            if (RoleAuth.isTeamTourist(role.team) && RoleAuth.isRegistered(role.system)) {
                return PackageAuth.canSearch(mode.other)
            }
        }

        // 系统注册用户
        if (RoleAuth.isRegistered(role.system)) {
            return PackageAuth.canSearch(mode.other)
        }

        // 游客
        return false
    }

    canPublishPackage(spec: INamedPackageSpec, user: IRuntimeUser) {
        const role = RoleAuth.parse(user.role)
        const mode = PackageAuth.parse(spec.mode)

        if (RoleAuth.isAdministrator(role.system)) {
            return true
        }

        if (RoleAuth.isTourist(role.system)) {
            return false
        }

        if (PackageUtility.isScopedPackage(spec.name)) {
            if (RoleAuth.isTeamOwner(role.team) || RoleAuth.isTeamAdministrator(role.team)) {
                return PackageAuth.canWrite(mode.owner)
            }

            if (RoleAuth.isTeamMember(role.team)) {
                return PackageAuth.canWrite(mode.group)
            }

            return false
        }

        if (RoleAuth.isRegistered(role.system)) {
            return PackageAuth.canWrite(mode.other)
        }

        return false
    }

    canDeprecatePackage(spec: INamedPackageSpec, user: IRuntimeUser) {
        const role = RoleAuth.parse(user.role)
        const mode = PackageAuth.parse(spec.mode)

        if (RoleAuth.isAdministrator(role.system)) {
            return true
        }

        if (RoleAuth.isTourist(role.system)) {
            return false
        }

        if (PackageUtility.isScopedPackage(spec.name)) {
            if (RoleAuth.isTeamOwner(role.team) || RoleAuth.isTeamAdministrator(role.team)) {
                return PackageAuth.canWrite(mode.owner)
            }

            if (RoleAuth.isTeamMember(role.team)) {
                return PackageAuth.canWrite(mode.group)
            }

            return false
        }

        return false
    }

    canAccessPackage(spec: INamedPackageSpec, user: IRuntimeUser) {
        const role = RoleAuth.parse(user.role)
        const mode = PackageAuth.parse(spec.mode)

        if (RoleAuth.isAdministrator(role.system)) {
            return true
        }

        if (RoleAuth.isTourist(role.system)) {
            return false
        }

        if (PackageUtility.isScopedPackage(spec.name)) {
            if (RoleAuth.isTeamOwner(role.team) || RoleAuth.isTeamAdministrator(role.team)) {
                return PackageAuth.canRead(mode.owner)
            }

            if (RoleAuth.isTeamMember(role.team)) {
                return PackageAuth.canRead(mode.group)
            }
        }

        return PackageAuth.canRead(mode.other)
    }
}

export const PackageAuth = new PackageControllor