export type IOInformation = {
    name: string;
    io_type: 'input' | 'output';
    bit: number;
    invert: boolean;
    disabled?: boolean;
};

export type IODefinition = {
    [key: string]: IOInformation;
};

export const inputDefinition: IODefinition = {
    pin_x_limit: {
        name: 'X Limit',
        io_type: 'input',
        bit: 0,
        invert: false,
    },
    pin_y_limit: {
        name: 'Y Limit',
        io_type: 'input',
        bit: 1,
        invert: false,
    },
    pin_z_limit: {
        name: 'Z Limit',
        io_type: 'input',
        bit: 2,
        invert: false,
    },
    pin_probe: {
        name: 'Probe',
        io_type: 'input',
        bit: 3,
        invert: false,
    },
    pin_reset: {
        name: 'Reset',
        io_type: 'input',
        bit: 4,
        invert: false,
    },
    pin_feed_hold: {
        name: 'Feed Hold',
        io_type: 'input',
        bit: 5,
        invert: false,
    },
    pin_cycle_start: {
        name: 'Cycle Start',
        io_type: 'input',
        bit: 6,
        invert: false,
    },
    pin_door: {
        name: 'Door',
        io_type: 'input',
        bit: 7,
        invert: false,
    },
};

export const outputDefinition: IODefinition = {
    pin_x_direction: {
        name: 'X Direction',
        io_type: 'output',
        bit: 16,
        invert: false,
        disabled: true,
    },
    pin_y_direction: {
        name: 'Y Direction',
        io_type: 'output',
        bit: 17,
        invert: false,
        disabled: true,
    },
    pin_z_direction: {
        name: 'Z Direction',
        io_type: 'output',
        bit: 18,
        invert: false,
        disabled: true,
    },
    pin_stepper_disable: {
        name: 'Stepper Disable',
        io_type: 'output',
        bit: 19,
        invert: false,
        disabled: true,
    },
    pin_coolant_flood: {
        name: 'Coolant Flood',
        io_type: 'output',
        bit: 20,
        invert: false,
        disabled: true,
    },
    pin_spindle_enable: {
        name: 'Spindle Enable',
        io_type: 'output',
        bit: 21,
        invert: false,
        disabled: true,
    },
    pin_spindle_direction: {
        name: 'Spindle Direction',
        io_type: 'output',
        bit: 22,
        invert: false,
        disabled: true,
    },
    pin_user_output_0: {
        name: 'User Output 0',
        io_type: 'output',
        bit: 23,
        invert:true,
    },
    pin_user_output_1: {
        name: 'User Output 1',
        io_type: 'output',
        bit: 24,
        invert:true,
    },
    pin_user_output_2: {
        name: 'User Output 2',
        io_type: 'output',
        bit: 25,
        invert:true,
    },
    pin_user_output_3: {
        name: 'User Output 3',
        io_type: 'output',
        bit: 26,
        invert:true,
    },
};