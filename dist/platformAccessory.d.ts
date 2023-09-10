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
    private coolingThresholdTemperature;
    private heatingThresholdTemperature;
    private targetTemp;
    private polling_interval;
    private targetHeaterCooler;
    private currentHeaterCooler;
    private active;
    private rotation;
    private swing;
    private turbo;
    private lockPhysicalControls;
    constructor(platform: PyluxCarrierACPlatform, accessory: PlatformAccessory, airConditioner: PlatformConfig);
    humidityPolling(): void;
    temperaturePolling(): void;
    temperatureCtoF(temperature: any): number;
    temperatureFtoC(temperature: any): number;
    sendJSON(jsonBody: string): Promise<string>;
    handleActiveGet(): Promise<0 | 1>;
    handleActiveSet(value: any): Promise<void>;
    handleCurrentHeaterCoolerStateGet(): Promise<number>;
    handleTargetHeaterCoolerStateGet(): Promise<number>;
    handleTargetHeaterCoolerStateSet(value: any): Promise<void>;
    temperaturePoll(update: boolean): Promise<void>;
    handleCurrentTemperatureGet(): number;
    handleRotationSpeedGet(): Promise<number>;
    handleRotationSpeedSet(value: any): Promise<void>;
    handleSwingModeGet(): Promise<number>;
    handleSwingModeSet(value: any): Promise<void>;
    handleTurboGet(): Promise<boolean>;
    handleTurboSet(value: any): Promise<void>;
    handleLockPhysicalControlsGet(): Promise<number>;
    handleLockPhysicalControlsSet(value: any): Promise<void>;
    handleTemperatureDisplayUnitsGet(): number;
    handleTemperatureDisplayUnitsSet(value: any): void;
    handleCoolingThresholdTemperatureGet(): Promise<number>;
    handleHeatingThresholdTemperatureGet(): number;
    handleCoolingThresholdTemperatureSet(value: any): Promise<void>;
    handleHeatingThresholdTemperatureSet(value: any): void;
    handleFilterChangeIndicationGet(): number;
    handleFilterLifeLevelGet(): number;
    handleResetFilterIndicationGet(): number;
    handleResetFilterIndicationSet(value: any): void;
    humidityPoll(update: boolean): Promise<void>;
    handleCurrentRelativeHumidityGet(): number;
}
//# sourceMappingURL=platformAccessory.d.ts.map