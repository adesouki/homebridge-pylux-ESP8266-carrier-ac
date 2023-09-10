"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyluxCarrierAC = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const pollingtoevent = require("polling-to-event");
class PyluxCarrierAC {
    constructor(platform, accessory, airConditioner) {
        this.platform = platform;
        this.accessory = accessory;
        this.targetHeaterCooler = {
            state: 0,
            temp: 0,
        };
        this.currentHeaterCooler = {
            state: 0,
            temp: 0.0,
            relativeHumidity: 0,
        };
        this.active = {
            state: 0,
        };
        this.rotation = {
            speed: 1,
        };
        this.swing = {
            mode: 0,
        };
        this.turbo = {
            state: false,
        };
        this.lockPhysicalControls = {
            state: 1,
        };
        this.targetTemp = 20;
        this.coolingThresholdTemperature = 20;
        this.heatingThresholdTemperature = 25;
        this.polling_interval = airConditioner.polling_interval;
        this.ip = airConditioner.ip;
        this.port = airConditioner.port;
        this.switchSerialNumber = airConditioner.serial;
        this.token = airConditioner.rpi_token;
        this.url = 'http://' + this.ip + ':' + this.port + '/ac';
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
            minValue: 0.0,
            maxValue: 50.0,
            minStep: 0.1,
        })
            .onGet(this.handleCurrentTemperatureGet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature)
            .setProps({
            minValue: 17,
            maxValue: 25,
            minStep: 1,
        })
            .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
            .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
            .setProps({
            minValue: 17,
            maxValue: 28,
            minStep: 1,
        })
            .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
            .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
            .onGet(this.handleTemperatureDisplayUnitsGet.bind(this))
            .onSet(this.handleTemperatureDisplayUnitsSet.bind(this));
        this.service
            .getCharacteristic(this.platform.Characteristic.SwingMode)
            .onGet(this.handleSwingModeGet.bind(this))
            .onSet(this.handleSwingModeSet.bind(this));
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
        this.service
            .getCharacteristic(this.platform.Characteristic.LockPhysicalControls)
            .setProps({
            description: 'LED',
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
        this.humidityPolling();
        this.temperaturePolling();
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
                    reject('User clicked cancel');
                    this.platform.log.info('ERROR:', error);
                    throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
                });
            }
            catch (error) {
                reject('User clicked cancel');
                this.platform.log.info('ERROR:', error);
                throw new this.platform.api.hap.HapStatusError(-70402 /* this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE */);
            }
        });
    }
    async handleActiveGet() {
        const jsonBody = JSON.stringify({ req: 'getActive', token: this.token });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        if (response.active) {
            this.active.state = this.platform.Characteristic.Active.ACTIVE;
            return this.platform.Characteristic.Active.ACTIVE;
        }
        else {
            this.active.state = this.platform.Characteristic.Active.INACTIVE;
            return this.platform.Characteristic.Active.INACTIVE;
        }
    }
    async handleActiveSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setActive',
            token: this.token,
            active: value,
            state: this.targetHeaterCooler.state,
            temp: this.coolingThresholdTemperature,
            fanSpeed: this.rotation.speed,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        if (response.active) {
            this.active.state = this.platform.Characteristic.Active.ACTIVE;
        }
        else {
            this.active.state = this.platform.Characteristic.Active.INACTIVE;
        }
        this.service.updateCharacteristic(this.platform.Characteristic.Active, this.active.state);
    }
    async handleCurrentHeaterCoolerStateGet() {
        const jsonBody = JSON.stringify({
            req: 'getCurrentHeaterCoolerState',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.currentHeaterCooler.state = response.state;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState, this.currentHeaterCooler.state);
        return this.currentHeaterCooler.state;
    }
    async handleTargetHeaterCoolerStateGet() {
        const jsonBody = JSON.stringify({
            req: 'getTargetHeaterCoolerState',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.targetHeaterCooler.state = response.state;
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.targetHeaterCooler.state);
        return this.targetHeaterCooler.state;
    }
    async handleTargetHeaterCoolerStateSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setTargetHeaterCoolerState',
            token: this.token,
            state: value,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.targetHeaterCooler.state = response.state;
        this.service.updateCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState, this.targetHeaterCooler.state);
    }
    async temperaturePoll(update) {
        const jsonBody = JSON.stringify({
            req: 'getCurrentTemp',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.currentHeaterCooler.temp = Math.round(response.temp * 100) / 100;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentHeaterCooler.temp);
        if (update)
            this.service
                .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
                .updateValue(this.currentHeaterCooler.temp);
    }
    handleCurrentTemperatureGet() {
        this.temperaturePoll(false);
        return this.currentHeaterCooler.temp;
    }
    async handleRotationSpeedGet() {
        const jsonBody = JSON.stringify({
            req: 'getRotationSpeed',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.rotation.speed = response.fanSpeed;
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.rotation.speed);
        return this.rotation.speed;
    }
    async handleRotationSpeedSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setRotationSpeed',
            token: this.token,
            fanSpeed: value,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.rotation.speed = response.fanSpeed;
        this.service.updateCharacteristic(this.platform.Characteristic.RotationSpeed, this.rotation.speed);
    }
    async handleSwingModeGet() {
        const jsonBody = JSON.stringify({
            req: 'getSwingMode',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.swing.mode = response.swingMode;
        this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.swing.mode);
        return this.swing.mode;
    }
    async handleSwingModeSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setSwingMode',
            token: this.token,
            swingMode: value,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.swing.mode = response.swingMode;
        this.service.updateCharacteristic(this.platform.Characteristic.SwingMode, this.swing.mode);
    }
    async handleTurboGet() {
        const jsonBody = JSON.stringify({
            req: 'getTurbo',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.turbo.state = response.turboMode;
        this.service.updateCharacteristic(this.platform.Characteristic.On, this.turbo.state);
        return this.turbo.state;
    }
    async handleTurboSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setTurbo',
            token: this.token,
            turboMode: value,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.turbo.state = response.turboMode;
        this.service.updateCharacteristic(this.platform.Characteristic.On, this.turbo.state);
    }
    async handleLockPhysicalControlsGet() {
        return this.lockPhysicalControls.state;
    }
    async handleLockPhysicalControlsSet(value) {
        const jsonBody = JSON.stringify({
            req: 'setLockPhysicalControls',
            token: this.token,
            led: value == 1 ? true : false,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.lockPhysicalControls.state = response.led;
        this.service.updateCharacteristic(this.platform.Characteristic.LockPhysicalControls, this.lockPhysicalControls.state);
    }
    handleTemperatureDisplayUnitsGet() {
        return this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;
    }
    handleTemperatureDisplayUnitsSet(value) {
        this.platform.log.debug('handleTemperatureDisplayUnitsSet ', value);
    }
    async handleCoolingThresholdTemperatureGet() {
        const jsonBody = JSON.stringify({
            req: 'getACTemp',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.coolingThresholdTemperature = response.acTemp;
        this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.coolingThresholdTemperature);
        return this.coolingThresholdTemperature;
    }
    handleHeatingThresholdTemperatureGet() {
        return this.heatingThresholdTemperature;
    }
    async handleCoolingThresholdTemperatureSet(value) {
        this.coolingThresholdTemperature = value;
        const jsonBody = JSON.stringify({
            req: 'setACTemp',
            token: this.token,
            temp: value,
        });
        await this.sendJSON(jsonBody);
        this.service.updateCharacteristic(this.platform.Characteristic.CoolingThresholdTemperature, this.coolingThresholdTemperature);
    }
    handleHeatingThresholdTemperatureSet(value) {
        this.platform.log.debug('handleHeatingThresholdTemperatureSet ', value);
    }
    handleFilterChangeIndicationGet() {
        return this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }
    handleFilterLifeLevelGet() {
        return 90;
    }
    handleResetFilterIndicationGet() {
        return 0;
    }
    handleResetFilterIndicationSet(value) {
        this.platform.log.debug('handleResetFilterIndicationSet ', value);
    }
    async humidityPoll(update) {
        const jsonBody = JSON.stringify({
            req: 'getRelativeHumidity',
            token: this.token,
        });
        const response = JSON.parse(await this.sendJSON(jsonBody));
        this.currentHeaterCooler.relativeHumidity = response.humidity;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.currentHeaterCooler.relativeHumidity);
        if (update)
            this.service
                .getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
                .updateValue(this.currentHeaterCooler.relativeHumidity);
    }
    handleCurrentRelativeHumidityGet() {
        this.humidityPoll(false);
        return this.currentHeaterCooler.relativeHumidity;
    }
}
exports.PyluxCarrierAC = PyluxCarrierAC;
//# sourceMappingURL=platformAccessory.js.map