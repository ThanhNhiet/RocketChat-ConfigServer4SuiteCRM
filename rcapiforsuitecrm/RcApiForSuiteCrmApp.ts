import {
    IAppAccessors,
    IConfigurationExtend,
    ILogger,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ApiSecurity, ApiVisibility } from '@rocket.chat/apps-engine/definition/api';
// import { SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { ScrmTokenEP } from './endpoints/ScrmTokenEP';
import { HelloWorldEP } from './endpoints/HelloWordEP';

export class RcApiForSuiteCrmApp extends App {
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

        await configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [
                new ScrmTokenEP(this),
                new HelloWorldEP(this),
            ],
        });
    }
}
