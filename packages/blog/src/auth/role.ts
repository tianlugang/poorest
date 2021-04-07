export const TEAM_ROLE = {
    tourist: 0,// 组织的游客
    owner: 1, // 组织创建者，拥有者
    admin: 2, // 组织管理员
    member: 3, // 组织的成员
}

export const SYSTEM_ROLE = {
    tourist: 0, // 游客
    admin: 1, // 超级管理员
    registered: 2, // 系统注册用户
}

export const SYSTEM_USER_ROLE_MODE = {
    admin: SYSTEM_ROLE.admin + '' + TEAM_ROLE.owner,
    registered: SYSTEM_ROLE.registered + '' + TEAM_ROLE.tourist
}
export class RoleControllor {
    isTourist(code: string | number) {
        return code == SYSTEM_ROLE.tourist
    }

    isAdministrator(code: string | number) {
        return code == SYSTEM_ROLE.admin
    }

    isRegistered(code: string | number) {
        return code == SYSTEM_ROLE.registered
    }

    isTeamTourist(code: string | number) {
        return code == TEAM_ROLE.tourist
    }

    isTeamAdministrator(code: string | number) {
        return code == TEAM_ROLE.admin
    }

    isTeamMember(code: string | number) {
        return code == TEAM_ROLE.member
    }

    isTeamOwner(code: string | number) {
        return code == TEAM_ROLE.owner
    }

    /**
     * @description 
     * 用户角色用一个 两位数表示
     * 第一位表示：用户在系统中的位置
     * 第二位表示：用户在当前组织里的位置
     */
    parse(mode: string) {
        const system = Number.parseInt(mode.charAt(0))
        const team = Number.parseInt(mode.charAt(1))

        return {
            system: Number.isNaN(system) ? 0 : (system % 4),
            team: Number.isNaN(team) ? 0 : (team % 3)
        }
    }
}

export const RoleAuth = new RoleControllor