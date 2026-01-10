import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';

export class ScrmTokenEP extends ApiEndpoint {
    public path = 'scrm-token';

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        const userId = request.headers['x-user-id'];
        
        if (!userId) {
            return { status: 400, content: { error: 'Missing x-user-id header' } };
        }

        const userReader = read.getUserReader();
        const user = await userReader.getById(userId);

        if (!user) {
            return { status: 404, content: { error: 'User not found' } };
        }

        if (user.customFields && user.customFields.suitecrm_token) {
            return {
                status: 200,
                content: {
                    success: true,
                    suitecrm_id: user.customFields.suitecrm_id,
                    accessToken: user.customFields.suitecrm_token,
                    refreshToken: user.customFields.suitecrm_refresh,
                    expiresAt: user.customFields.suitecrm_expires_at
                }
            };
        }

        // In case the token is not yet synced
        return {
            status: 404,
            content: { 
                error: 'Token not ready yet. Please retry in 1 second.',
                code: 'TOKEN_SYNCING'
            }
        };
    }
}