import { PlatformAccessory, PlatformConfig } from 'homebridge';
import { PyluxCarrierACPlatform } from './platform';
export declare class PyluxCarrierAC {
    private readonly platform;
    private readonly accessory;
    private service;
    private token;
    private ip;
    private port;
    private switchSerialNumber;
    private url;
    private TurboSwitch;
    private polling_interval;
    private dataFilePath;
    private historyFileJSON;
    private targetHeaterCooler;
    private currentHeaterCooler;
    private active;
    private rotation;
    private swing;
    private turbo;
    private lockPhysicalControls;
    constructor(platform: PyluxCarrierACPlatform, accessory: PlatformAccessory, airConditioner: PlatformConfig);
    writeConfigHistory(jsonBody: any): void;
    readConfigHistory(): void;
    humidityPolling(): void;
    temperaturePolling(): void;
    temperatureCtoF(temperature: any): number;
    temperatureFtoC(temperature: any): number;
    sendJSON(jsonBody: string): Promise<string>;
    handleActiveGet(): Promise<any>;
    handleActiveSet(value: any): Promise<void>;
    handleCurrentHeaterCoolerStateGet(): Promise<any>;
    handleTargetHeaterCoolerStateGet(): Promise<any>;
    handleTargetHeaterCoolerStateSet(value: any): Promise<void>;
    temperaturePoll(update: boolean): Promise<void>;
    handleCurrentTemperatureGet(): any;
    handleRotationSpeedGet(): Promise<any>;
    handleRotationSpeedSet(value: any): Promise<void>;
    handleSwingModeGet(): Promise<any>;
    handleSwingModeSet(value: any): Promise<void>;
    handleTurboGet(): Promise<any>;
    handleTurboSet(value: any): Promise<void>;
    handleLockPhysicalControlsGet(): Promise<any>;
    handleLockPhysicalControlsSet(value: any): Promise<void>;
    handleTemperatureDisplayUnitsGet(): any;
    handleTemperatureDisplayUnitsSet(value: any): void;
    handleCoolingThresholdTemperatureGet(): Promise<any>;
    handleHeatingThresholdTemperatureGet(): any;
    handleCoolingThresholdTemperatureSet(value: any): Promise<void>;
    handleHeatingThresholdTemperatureSet(value: any): void;
    handleFilterChangeIndicationGet(): number;
    handleFilterLifeLevelGet(): number;
    handleResetFilterIndicationGet(): number;
    handleResetFilterIndicationSet(value: any): void;
    humidityPoll(update: boolean): Promise<void>;
    handleCurrentRelativeHumidityGet(): any;
}
//# sourceMappingURL=platformAccessory.d.ts.map