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
import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { ScrmTokenEP } from './endpoints/ScrmTokenEP';
import { HelloWorldEP } from './endpoints/HelloWordEP';
import {
    IUIKitInteractionHandler,
    IUIKitResponse,
    UIKitActionButtonInteractionContext,
    UIKitViewSubmitInteractionContext,
    UIKitBlockInteractionContext
} from '@rocket.chat/apps-engine/definition/uikit';
import { AppEnum } from './client/constants/enum';
import { ActionHandler } from './client/handlers/ActionHandler';
import { SubmitHandler } from './client/handlers/SubmitHandler';
import { IUIActionButtonDescriptor, UIActionButtonContext } from '@rocket.chat/apps-engine/definition/ui';

export class CreateTaskForSuiteCRMApp extends App implements IUIKitInteractionHandler {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        await configuration.settings.provideSetting({
            id: 'server_url',
            type: SettingType.STRING,
            packageValue: 'http://..',
            required: true,
            public: false,
            i18nLabel: 'Rocket.Chat URL',
            i18nDescription: 'The URL of your Rocket.Chat server.',
        });

        const createTaskButton: IUIActionButtonDescriptor = {
            actionId: AppEnum.ACTION_CREATE_TASK,
            labelI18n: 'scrm_task_create_title',
            context: UIActionButtonContext.MESSAGE_ACTION,
        };
        configuration.ui.registerButton(createTaskButton);

        // await configuration.api.provideApi({
        //     visibility: ApiVisibility.PUBLIC,
        //     security: ApiSecurity.UNSECURE,
        //     endpoints: [
        //         new ScrmTokenEP(this),
        //         new HelloWorldEP(this),
        //     ],
        // });
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

    // 2.1. Điều phối sự kiện block action (cho reset token button)
    public async executeBlockActionHandler(
        context: UIKitBlockInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        // Gọi class xử lý riêng
        return new ActionHandler(read, http, modify, persistence).runBlockAction(context);
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
