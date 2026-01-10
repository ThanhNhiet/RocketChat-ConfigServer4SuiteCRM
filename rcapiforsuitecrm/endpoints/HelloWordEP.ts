import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';

export class HelloWorldEP extends ApiEndpoint {
    // Đường dẫn sẽ là: /api/apps/public/<app-id>/abc-endpoint
    public path = 'hello'; 

    public async get(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence,
    ): Promise<IApiResponse> {
        return {
            status: 200,
            content: { message: 'Hello world' }
        };
    }
}