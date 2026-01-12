import {
    IAppAccessors,
    IConfigurationExtend,
    ILogger,
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
// import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { ScrmTokenEP } from './endpoints/ScrmTokenEP';
import { HelloWorldEP } from './endpoints/HelloWordEP';
import {
    IUIKitInteractionHandler,
    IUIKitResponse,
    UIKitActionButtonInteractionContext,
    UIKitViewSubmitInteractionContext
} from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from './client/constants/enum';
import { ActionHandler } from './client/handlers/ActionHandler';
import { SubmitHandler } from './client/handlers/SubmitHandler';
import { IUIActionButtonDescriptor, UIActionButtonContext } from '@rocket.chat/apps-engine/definition/ui';

export class RcApiForSuiteCrmApp extends App implements IUIKitInteractionHandler {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        // await configuration.settings.provideSetting({
        //     id: 'admin_id',
        //     type: SettingType.STRING,
        //     packageValue: 'B6J7b9AnXWCAB4YdE',
        //     required: true,
        //     public: false,
        //     i18nLabel: 'Admin User ID',
        //     i18nDescription: 'ID of the Admin user in Rocket.Chat',
        // });

        // await configuration.settings.provideSetting({
        //     id: 'admin_token',
        //     type: SettingType.STRING,
        //     packageValue: '1euCBGgvUSwV1s_GYPE3Xt3SQC5_5zkrLyrrIGk0gt9',
        //     required: true,
        //     public: false,
        //     i18nLabel: 'Admin Personal Access Token',
        //     i18nDescription: 'Token created in My Account > Personal Access Tokens',
        // });

        // await configuration.settings.provideSetting({
        //     id: 'server_url',
        //     type: SettingType.STRING,
        //     packageValue: 'http://localhost:3000',
        //     required: true,
        //     public: false,
        //     i18nLabel: 'Rocket.Chat Local URL',
        //     i18nDescription: 'Local URL for the App to call API (usually http://localhost:3000)',
        // });

        const createTaskButton: IUIActionButtonDescriptor = {
            actionId: AppEnum.ACTION_CREATE_TASK,
            labelI18n: 'Create_Task',
            context: UIActionButtonContext.MESSAGE_ACTION,
        };
        configuration.ui.registerButton(createTaskButton);

        await configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new ScrmTokenEP(this),
                new HelloWorldEP(this),
            ],
        });
    }

    // 2. Điều phối sự kiện bấm nút
    public async executeActionButtonHandler(
        context: UIKitActionButtonInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        // Gọi class xử lý riêng
        return new ActionHandler(read, http, modify, persistence).run(context);
    }

    // 3. Điều phối sự kiện Submit Modal
    public async executeViewSubmitHandler(
        context: UIKitViewSubmitInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        // Gọi class xử lý riêng
        return new SubmitHandler(read, http, modify, persistence).run(context);
    }
}
