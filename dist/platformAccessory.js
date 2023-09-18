"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyluxCarrierAC = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const pollingtoevent = require("polling-to-event");
const fs_1 = require("fs");
class PyluxCarrierAC {
    constructor(platform, accessory, airConditioner) {
        this.platform = platform;
        this.accessory = accessory;
        this.polling_interval = airConditioner.polling_interval;
        this.ip = airConditioner.ip;
        this.port = airConditioner.port;
        this.switchSerialNumber = airConditioner.serial;
        this.token = airConditioner.rpi_token;
        let dir = this.getUserHome() + '/.actemp';
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, 0o744);
        }
        this.dataFilePath = dir + '/data' + this.token + '.json';
        this.url = 'http://' + this.ip + ':' + this.port + '/ac';
        this.readConfigHistory();
        this.usesFahrenheit = this.historyFileJSON.units == 0 ? false : true;
        this.accessory
            .getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Pylux Solutions, LLC.')
            .setCharacteristic(this.platform.Characteristic.Model, 'Pylux Smart Carrier AC Remote')
            .setCharacteristic(this.platform.Characteristic.SerialNumber, this.switchSerialNumber);
        this.service =
            this.accessory.getService(this.platform.Service.HeaterCooler) ||
                this.accessory.addService(this.platform.Service.HeaterCooler);
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .onGet(this.handleActiveGet.bind(this))
            .onSet(this.handleActiveSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
            .onGet(this.handleCurrentHeaterCoolerStateGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
            .onGet(this.handleTargetHeaterCoolerStateGet.bind(this))
            .onSet(this.handleTargetHeaterCoolerStateSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({
            minValue: -100.0,
            maxValue: 100.0,
            minStep: 0.1,
        })
            .onGet(this.handleCurrentTemperatureGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .setProps({
            minValue: this.usesFahrenheit ? 62.6 : 17,
            maxValue: this.usesFahrenheit ? 77 : 26,
            minStep: this.usesFahrenheit ? 0.1 : 1,
        })
            .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
            .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({
            minValue: this.usesFahrenheit ? 62.6 : 17,
            // minValue: this.usesFahrenheit ? 68 : 20,
            maxValue: this.usesFahrenheit ? 82.4 : 28,
            minStep: this.usesFahrenheit ? 0.1 : 1,
        })
            .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
            .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
            .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
            .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.RotationSpeed)
            .setProps({
            minStep: 1,
            minValue: 1,
            maxValue: 4,
            validValues: [1, 2, 3, 4],
        })
            .onGet(this.handleRotationSpeedGet.bind(this))
            .onSet(this.handleRotationSpeedSet.bind(this));
        this.TurboSwitch =
            this.accessory.getService('Turbo') ||
                this.accessory.addService(this.platform.Service.Switch, 'Turbo', 'TurboSwitch');
        this.TurboSwitch.getCharacteristic(this.platform.Characteristic.On)
            .onGet(this.handleTurboGet.bind(this))
            .onSet(this.handleTurboSet.bind(this));
        this.service.addLinkedService(this.TurboSwitch);
        this.service
            .getCharacteristic(this.platform.Characteristic.SwingMode)
            .onGet(this.handleSwingModeGet.bind(this))
            .onSet(this.handleSwingModeSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
            .setProps({
            minValue: 0,
            maxValue: 1,
            minStep: 1,
            validValues: [0, 1],
        })
            .onGet(this.handleLockPhysicalControlsGet.bind(this))
            .onSet(this.handleLockPhysicalControlsSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
            .onGet(this.handleFilterChangeIndicationGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.ResetFilterIndication)
            .onGet(this.handleResetFilterIndicationGet.bind(this))
            .onSet(this.handleResetFilterIndicationSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
            .onGet(this.handleCurrentRelativeHumidityGet.bind(this));
        this.service.setPrimaryService(true);
        this.humidityPolling();
        this.temperaturePolling();
    }
    getUserHome() {
        return process.env.HOME || process.env.USERPROFILE;
    }
    writeConfigHistory(jsonBody) {
        (0, fs_1.writeFileSync)(this.dataFilePath, jsonBody, {
            flag: 'w',
        });
    }
    readConfigHistory() {
        if (!(0, fs_1.existsSync)(this.dataFilePath)) {
            //first init config.
            const jsonBody = JSON.stringify({
                targetHeaterCooler_state: 2,
                targetHeaterCooler_temp: 20,
                currentHeaterCooler_state: 3,
                currentHeaterCooler_temp: 0,
                currentHeaterCooler_relativeHumidity: 0,
                units: 0,
                active_state: 0,
                rotation_speed: 4,
                swing_mode: 0,
                turbo_state: 0,
                lockPhysicalControls_state: 0,
                coolingThresholdTemperature: 20,
                heatingThresholdTemperature: 25,
            });
            this.writeConfigHistory(jsonBody);
        }
        this.historyFileJSON = JSON.parse((0, fs_1.readFileSync)(this.dataFilePath, 'utf-8'));
    }
    humidityPolling() {
        pollingtoevent(() => {
            this.humidityPoll(true);
        }, {
            longpolling: true,
            interval: this.polling_interval,
            longpollEventName: 'humidityPoll',
        });
    }
    temperaturePolling() {
        pollingtoevent(() => {
            this.temperaturePoll(false);
        }, {
            longpolling: true,
            interval: this.polling_interval,
            longpollEventName: 'temperaturePoll',
        });
    }
    temperatureCtoF(temperature) {
        const temp = (temperature * 9) / 5 + 32;
        const whole = Math.round(temp);
        return Math.trunc(whole);
    }
    temperatureFtoC(temperature) {
        const temp = ((temperature - 32) * 5) / 9;
        const abs = Math.abs(temp);
        const whole = Math.trunc(abs);
        let fraction = (abs - whole) * 10;
        fraction = Math.trunc(fraction) / 10;
        return temp < 0 ? -(fraction + whole) : fraction + whole;
    }
    //we need to Q send so we dont overflow.
    sendJSON(jsonBody) {
        return new Promise((resolve, reject) => {
            try {
                (0, node_fetch_1.default)(this.url, {
                    method: 'POST',
                    body: jsonBody,
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json, text/plain, */*',
                    },
                })
                    .then((res) => res.json())
                    .then((res) => {
                    resolve(JSON.stringify(res));
                })
                    .catch((error) => {
                    return 'ERROR';
                    this.platform.log.info('ERROR:', error);
                });
            }
            catch (error) {
                return 'ERROR';
                this.platform.log.info('ERROR:', error);
            }
        });
    }
    async handleActiveGet() {
        this.platform.log.debug('handleActiveGet ', this.historyFileJSON.active_state);
        return this.historyFileJSON.active_state;
    }
    async handleActiveSet(value) {
        this.platform.log.debug('handleActiveSet ', value);
        //handle heating and auto state in temp.
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            let tempValue = 0.0;
            if (this.historyFileJSON.units == 0)
                tempValue = this.historyFileJSON.coolingThresholdTemperature; //convert
            else
                tempValue = this.temperatureFtoC(this.historyFileJSON.coolingThresholdTemperature); //convert
            const jsonBody = JSON.stringify({
                req: 'setActive',
                token: this.token,
                active: value,
                state: this.historyFileJSON.targetHeaterCooler_state,
                temp: tempValue,
                fanSpeed: this.historyFileJSON.rotation_speed,
            });
            const res = await this.sendJSON(jsonBody);
            if (res != 'ERROR') {
                const response = JSON.parse(res);
                if (response.active) {
                    this.historyFileJSON.active_state =
                        this.platform.Characteristic.Active.ACTIVE;
                }
                else {
                    this.historyFileJSON.active_state =
                        this.platform.Characteristic.Active.INACTIVE;
                }
            }
            this.service.updateCharacteristic(this.platform.Characteristic.Active, this.historyFileJSON.active_state);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
        this.service
            .getCharacteristic(this.platform.Characteristic.Active)
            .updateValue(this.historyFileJSON.active_state);
    }
    async handleCurrentHeaterCoolerStateGet() {
        this.platform.log.debug('handleCurrentHeaterCoolerStateGet ', this.historyFileJSON.currentHeaterCooler_state);
        return this.historyFileJSON.currentHeaterCooler_state;
    }
    async handleTargetHeaterCoolerStateGet() {
        this.platform.log.debug('handleTargetHeaterCoolerStateGet ', this.historyFileJSON.targetHeaterCooler_state);
        return this.historyFileJSON.targetHeaterCooler_state;
    }
    async handleTargetHeaterCoolerStateSet(value) {
        this.platform.log.debug('handleTargetHeaterCoolerStateSet ', value);
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            const jsonBody = JSON.stringify({
                req: 'setTargetHeaterCoolerState',
                token: this.token,
                state: value,
            });
            const res = await this.sendJSON(jsonBody);
            if (res != 'ERROR') {
                const response = JSON.parse(res);
                this.historyFileJSON.targetHeaterCooler_state = response.state;
                if (this.historyFileJSON.targetHeaterCooler_state ==
                    this.platform.Characteristic.TargetHeaterCoolerState.COOL) {
                    this.historyFileJSON.currentHeaterCooler_state =
                        this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
                }
                else if (this.historyFileJSON.targetHeaterCooler_state ==
                    this.platform.Characteristic.TargetHeaterCoolerState.HEAT) {
                    this.historyFileJSON.currentHeaterCooler_state =
                        this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
                }
                else if (this.historyFileJSON.targetHeaterCooler_state ==
                    this.platform.Characteristic.TargetHeaterCoolerState.AUTO) {
                    if (this.historyFileJSON.currentHeaterCooler_temp >
                        this.historyFileJSON.coolingThresholdTemperature)
                        this.historyFileJSON.currentHeaterCooler_state =
                            this.platform.Characteristic.CurrentHeaterCoolerState.COOLING;
                    else
                        this.historyFileJSON.currentHeaterCooler_state =
                            this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
                }
            }
            this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.historyFileJSON.targetHeaterCooler_state);
            this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.historyFileJSON.currentHeaterCooler_state);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
    }
    async temperaturePoll(update) {
        const jsonBody = JSON.stringify({
            req: 'getCurrentTemp',
            token: this.token,
        });
        const res = await this.sendJSON(jsonBody);
        if (res != 'ERROR') {
            const response = JSON.parse(res);
            if (this.historyFileJSON.units == 0)
                this.historyFileJSON.currentHeaterCooler_temp =
                    Math.round(response.temp * 100) / 100;
            else
                this.historyFileJSON.currentHeaterCooler_temp = this.temperatureCtoF(response.temp);
        }
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.historyFileJSON.currentHeaterCooler_temp);
        if (update)
            this.service
                .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                .updateValue(this.historyFileJSON.currentHeaterCooler_temp);
        this.platform.log.debug('temperaturePoll ', this.historyFileJSON.currentHeaterCooler_temp);
        this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
    }
    handleCurrentTemperatureGet() {
        this.platform.log.debug('handleCurrentTemperatureGet ', this.historyFileJSON.currentHeaterCooler_temp);
        return this.historyFileJSON.currentHeaterCooler_temp;
    }
    async handleRotationSpeedGet() {
        return this.historyFileJSON.rotation_speed;
    }
    async handleRotationSpeedSet(value) {
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            const jsonBody = JSON.stringify({
                req: 'setRotationSpeed',
                token: this.token,
                fanSpeed: value,
            });
            const res = await this.sendJSON(jsonBody);
            if (res != 'ERROR') {
                const response = JSON.parse(res);
                this.historyFileJSON.rotation_speed = response.fanSpeed;
            }
            this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.historyFileJSON.rotation_speed);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
    }
    async handleSwingModeGet() {
        return this.historyFileJSON.swing_mode;
    }
    async handleSwingModeSet(value) {
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            const jsonBody = JSON.stringify({
                req: 'setSwingMode',
                token: this.token,
                swingMode: value,
            });
            const res = await this.sendJSON(jsonBody);
            if (res != 'ERROR') {
                const response = JSON.parse(res);
                this.historyFileJSON.swing_mode = response.swingMode;
            }
            this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.historyFileJSON.swing_mode);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
    }
    async handleTurboGet() {
        return this.historyFileJSON.turbo_state;
    }
    async handleTurboSet(value) {
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            const jsonBody = JSON.stringify({
                req: 'setTurbo',
                token: this.token,
                turboMode: value,
            });
            const res = await this.sendJSON(jsonBody);
            if (res != 'ERROR') {
                const response = JSON.parse(res);
                this.historyFileJSON.turbo_state = response.turboMode;
            }
            this.service.updateCharacteristic(this.platform.Characteristic.On, this.historyFileJSON.turbo_state);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
    }
    async handleLockPhysicalControlsGet() {
        return this.historyFileJSON.lockPhysicalControls_state;
    }
    async handleLockPhysicalControlsSet(value) {
        this.historyFileJSON.lockPhysicalControls_state = value;
        this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.historyFileJSON.lockPhysicalControls_state);
        this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
    }
    handleTemperatureDisplayUnitsGet() {
        this.platform.log.debug('handleTemperatureDisplayUnitsGet ', this.historyFileJSON.units);
        return this.historyFileJSON.units;
    }
    handleTemperatureDisplayUnitsSet(value) {
        this.platform.log.debug('handleTemperatureDisplayUnitsSet ', value);
        this.historyFileJSON.units = value;
        this.usesFahrenheit = this.historyFileJSON.units == 0 ? false : true;
        if (this.historyFileJSON.currentHeaterCooler_temp < 55 &&
            this.usesFahrenheit) {
            this.historyFileJSON.currentHeaterCooler_temp = this.temperatureCtoF(this.historyFileJSON.currentHeaterCooler_temp);
        }
        else if (this.historyFileJSON.currentHeaterCooler_temp > 55 &&
            !this.usesFahrenheit) {
            this.historyFileJSON.currentHeaterCooler_temp = this.temperatureFtoC(this.historyFileJSON.currentHeaterCooler_temp);
        }
        this.service
            .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
            .setProps({
            minStep: this.usesFahrenheit ? 0.1 : 1,
        })
            .updateValue(this.historyFileJSON.currentHeaterCooler_temp);
        if (this.historyFileJSON.coolingThresholdTemperature < 55 &&
            this.usesFahrenheit) {
            this.historyFileJSON.coolingThresholdTemperature = this.temperatureCtoF(this.historyFileJSON.coolingThresholdTemperature);
        }
        else if (this.historyFileJSON.coolingThresholdTemperature > 55 &&
            !this.usesFahrenheit) {
            this.historyFileJSON.coolingThresholdTemperature = this.temperatureFtoC(this.historyFileJSON.coolingThresholdTemperature);
        }
        // this.service.removeCharacteristic(
        //   this.platform.Characteristic.CoolingThresholdTemperature
        // );
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: this.usesFahrenheit ? 0.1 : 1,
        })
            .updateValue(this.historyFileJSON.coolingThresholdTemperature)
            .setProps({
            minValue: this.usesFahrenheit ? 62.6 : 17,
            maxValue: this.usesFahrenheit ? 77 : 26,
        });
        if (this.historyFileJSON.heatingThresholdTemperature < 55 &&
            this.usesFahrenheit) {
            this.historyFileJSON.heatingThresholdTemperature = this.temperatureCtoF(this.historyFileJSON.heatingThresholdTemperature);
        }
        else if (this.historyFileJSON.heatingThresholdTemperature > 55 &&
            !this.usesFahrenheit) {
            this.historyFileJSON.heatingThresholdTemperature = this.temperatureFtoC(this.historyFileJSON.heatingThresholdTemperature);
        }
        // this.service.removeCharacteristic(
        //   this.platform.Characteristic.HeatingThresholdTemperature
        // );
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({
            minValue: 0,
            maxValue: 100,
            minStep: this.usesFahrenheit ? 0.1 : 1,
        })
            .updateValue(this.historyFileJSON.heatingThresholdTemperature)
            .setProps({
            minValue: this.usesFahrenheit ? 62.6 : 17,
            maxValue: this.usesFahrenheit ? 82.4 : 28,
        });
        this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
    }
    async handleCoolingThresholdTemperatureGet() {
        if (this.historyFileJSON.coolingThresholdTemperature > 55 &&
            !this.usesFahrenheit)
            this.historyFileJSON.coolingThresholdTemperature = this.temperatureFtoC(this.historyFileJSON.coolingThresholdTemperature);
        this.platform.log.debug('handleCoolingThresholdTemperatureGet ', this.historyFileJSON.coolingThresholdTemperature);
        return this.historyFileJSON.coolingThresholdTemperature;
    }
    handleHeatingThresholdTemperatureGet() {
        //safety
        if (this.historyFileJSON.heatingThresholdTemperature > 55 &&
            !this.usesFahrenheit)
            this.historyFileJSON.heatingThresholdTemperature = this.temperatureFtoC(this.historyFileJSON.heatingThresholdTemperature);
        this.platform.log.debug('handleHeatingThresholdTemperatureGet ', this.historyFileJSON.heatingThresholdTemperature);
        return this.historyFileJSON.heatingThresholdTemperature;
    }
    async handleCoolingThresholdTemperatureSet(value) {
        this.platform.log.debug('handleCoolingThresholdTemperatureSet ', value);
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            this.historyFileJSON.coolingThresholdTemperature = value;
            let tempValue = 0.0;
            if (this.historyFileJSON.units == 0)
                tempValue = value;
            else
                tempValue = this.temperatureFtoC(value);
            const jsonBody = JSON.stringify({
                req: 'setACTemp',
                token: this.token,
                temp: tempValue,
            });
            await this.sendJSON(jsonBody);
            this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.historyFileJSON.coolingThresholdTemperature);
            this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
        }
    }
    //TODO
    handleHeatingThresholdTemperatureSet(value) {
        if (!this.historyFileJSON.lockPhysicalControls_state) {
            this.historyFileJSON.coolingThresholdTemperature = value;
            let tempValue = 0.0;
            if (this.historyFileJSON.units == 0)
                tempValue = value; //convert
            else
                tempValue = this.temperatureFtoC(value); //convert
            this.platform.log.debug('handleHeatingThresholdTemperatureSet ', this.historyFileJSON.heatingThresholdTemperature);
        }
    }
    //TODO
    handleFilterChangeIndicationGet() {
        return this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }
    //TODO
    handleFilterLifeLevelGet() {
        return 90;
    }
    //TODO
    handleResetFilterIndicationGet() {
        return 0;
    }
    //TODO
    handleResetFilterIndicationSet(value) {
        this.platform.log.debug('handleResetFilterIndicationSet ', value);
    }
    async humidityPoll(update) {
        const jsonBody = JSON.stringify({
            req: 'getRelativeHumidity',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        if (response != 'ERROR') {
            this.historyFileJSON.currentHeaterCooler_relativeHumidity =
                response.humidity;
        }
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.historyFileJSON.currentHeaterCooler_relativeHumidity);
        if (update)
            this.service
                .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
                .updateValue(this.historyFileJSON.currentHeaterCooler_relativeHumidity);
        this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
    }
    handleCurrentRelativeHumidityGet() {
        return this.historyFileJSON.currentHeaterCooler_relativeHumidity;
    }
}
exports.PyluxCarrierAC = PyluxCarrierAC;
//# sourceMappingURL=platformAccessory.js.map