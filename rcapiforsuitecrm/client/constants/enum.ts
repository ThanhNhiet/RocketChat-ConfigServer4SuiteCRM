// src/constants/enums.ts

export enum AppEnum {
    // Action ID cho nút bấm trên Toolbar
    ACTION_CREATE_TASK = 'create-suitecrm-task',
    ACTION_RESET_TOKEN = 'reset_token_action',
    
    // ID của Modal
    MODAL_ID = 'task-creation-modal',
    TOKEN_SETUP_MODAL_ID = 'token-setup-modal',
    
    // Các Block ID (dùng để định danh hàng input)
    BLOCK_TASK_NAME = 'task_name_block',
    BLOCK_TASK_DESC = 'task_desc_block',
    BLOCK_TASK_PRIORITY = 'task_priority_block',
    BLOCK_TOKEN_INPUT = 'token_input_block',
    BLOCK_ERROR_MESSAGE = 'error_message_block',
    BLOCK_LOADING = 'loading_block',
    
    // Các Action ID của Input (dùng để lấy giá trị user nhập)
    INPUT_TASK_NAME = 'task_name_input',
    INPUT_TASK_DESC = 'task_desc_input',
    INPUT_TASK_PRIORITY = 'task_priority_input',
    INPUT_TOKEN = 'token_input',
    
    // Persistence keys
    PERSISTENCE_USER_TOKEN_PREFIX = 'user_token_',
    PERSISTENCE_SCRM_SERVICE_PREFIX = 'scrm_service_',
}