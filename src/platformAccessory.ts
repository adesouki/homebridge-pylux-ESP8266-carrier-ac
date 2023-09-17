import { Service, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PyluxCarrierACPlatform } from './platform';
import fetch from 'node-fetch';

import pollingtoevent = require('polling-to-event');

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class PyluxCarrierAC {
  private service: Service;
  private token: string;
  private ip: string;
  private port: number;
  private switchSerialNumber: string;
  private url: string;
  private TurboSwitch: Service;
  // private coolingThresholdTemperature: number;
  // private heatingThresholdTemperature: number;
  private polling_interval: number;
  // private units: number;
  private dataFilePath: string;
  private historyFileJSON: any;

  private targetHeaterCooler = {
    state: this.platform.Characteristic.TargetHeaterCoolerState.AUTO,
    temp: 0,
  };

  private currentHeaterCooler = {
    state: this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE,
    temp: 0.0,
    relativeHumidity: 0,
  };

  private active = {
    state: 0,
  };

  private rotation = {
    speed: 4,
  };

  private swing = {
    mode: 0,
  };

  private turbo = {
    state: false,
  };

  private lockPhysicalControls = {
    state: 1,
  };

  constructor(
    private readonly platform: PyluxCarrierACPlatform,
    private readonly accessory: PlatformAccessory,
    airConditioner: PlatformConfig
  ) {
    this.polling_interval = airConditioner.polling_interval as number;
    this.ip = airConditioner.ip as string;
    this.port = airConditioner.port as number;
    this.switchSerialNumber = airConditioner.serial as string;
    this.token = airConditioner.rpi_token as string;
    this.dataFilePath = './data' + this.token + '.json';
    this.url = 'http://' + this.ip + ':' + this.port + '/ac';

    this.readConfigHistory();

    // this.historyFileJSON.coolingThresholdTemperature = this.historyFileJSON.coolingThresholdTemperature;
    // this.historyFileJSON.heatingThresholdTemperature; = this.historyFileJSON.heatingThresholdTemperature;
    // this.historyFileJSON.units = this.historyFileJSON.units;

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Pylux Solutions, LLC.'
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'Pylux Smart Carrier AC Remote'
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.switchSerialNumber
      );

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
      .getCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature
      )
      .setProps({
        minValue: 17,
        maxValue: 25,
        minStep: 1,
      })
      .onGet(this.handleCoolingThresholdTemperatureGet.bind(this))
      .onSet(this.handleCoolingThresholdTemperatureSet.bind(this));

    this.service
      .getCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature
      )
      .setProps({
        minValue: 17,
        maxValue: 28,
        minStep: 1,
      })
      .onGet(this.handleHeatingThresholdTemperatureGet.bind(this))
      .onSet(this.handleHeatingThresholdTemperatureSet.bind(this));
    // minStep: this.usesFahrenheit ? 0.1 : 1
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
      this.accessory.addService(
        this.platform.Service.Switch,
        'Turbo',
        'TurboSwitch'
      );

    this.TurboSwitch.getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleTurboGet.bind(this))
      .onSet(this.handleTurboSet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.SwingMode)
      .onGet(this.handleSwingModeGet.bind(this))
      .onSet(this.handleSwingModeSet.bind(this));

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

  writeConfigHistory(jsonBody: any) {
    writeFileSync(join(__dirname, this.dataFilePath), jsonBody, {
      flag: 'w',
    });
  }

  readConfigHistory() {
    if (!existsSync(this.dataFilePath)) {
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

    this.historyFileJSON = JSON.parse(
      readFileSync(join(__dirname, this.dataFilePath), 'utf-8')
    );
  }

  humidityPolling() {
    pollingtoevent(
      () => {
        this.humidityPoll(true);
      },
      {
        longpolling: true,
        interval: this.polling_interval,
        longpollEventName: 'humidityPoll',
      }
    );
  }

  temperaturePolling() {
    pollingtoevent(
      () => {
        this.temperaturePoll(false);
      },
      {
        longpolling: true,
        interval: this.polling_interval,
        longpollEventName: 'temperaturePoll',
      }
    );
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
  sendJSON(jsonBody: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        fetch(this.url, {
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
          });
      } catch (error) {
        reject('User clicked cancel');
        this.platform.log.info('ERROR:', error);
      }
    });
  }

  async handleActiveGet() {
    return this.historyFileJSON.active_state;
  }

  async handleActiveSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setActive',
      token: this.token,
      active: value,
      state: this.historyFileJSON.targetHeaterCooler_state,
      temp: this.historyFileJSON.coolingThresholdTemperature, //convert and check mode first,
      fanSpeed: this.historyFileJSON.rotation_speed,
    });
    const response = JSON.parse(await this.sendJSON(jsonBody));
    if (response.active) {
      this.historyFileJSON.active_state =
        this.platform.Characteristic.Active.ACTIVE;
    } else {
      this.historyFileJSON.active_state =
        this.platform.Characteristic.Active.INACTIVE;
    }
    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      this.historyFileJSON.active_state
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  // set proper target and current state of HeaterCoolerService
  // if (this.state.mode === 'COOL') {
  // 	this.updateValue('HeaterCoolerService', 'TargetHeaterCoolerState', Characteristic.TargetHeaterCoolerState.COOL)
  // 	this.updateValue('HeaterCoolerService', 'CurrentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState.COOLING)
  // } else if (this.state.mode === 'HEAT') {
  // 	this.updateValue('HeaterCoolerService', 'TargetHeaterCoolerState', Characteristic.TargetHeaterCoolerState.HEAT)
  // 	this.updateValue('HeaterCoolerService', 'CurrentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState.HEATING)
  // } else if (this.state.mode === 'AUTO') {
  // 	this.updateValue('HeaterCoolerService', 'TargetHeaterCoolerState', Characteristic.TargetHeaterCoolerState.AUTO)
  // 	if (this.state.currentTemperature > this.state.targetTemperature)
  // 		this.updateValue('HeaterCoolerService', 'CurrentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState.COOLING)
  // 	else
  // 		this.updateValue('HeaterCoolerService', 'CurrentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState.HEATING)
  // }

  async handleCurrentHeaterCoolerStateGet() {
    //TODO Think about it. there are no set for it
    return this.historyFileJSON.currentHeaterCooler_state;
  }

  async handleTargetHeaterCoolerStateGet() {
    return this.historyFileJSON.targetHeaterCooler_state;
  }

  async handleTargetHeaterCoolerStateSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setTargetHeaterCoolerState',
      token: this.token,
      state: value,
    });
    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.targetHeaterCooler_state = response.state;
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHeaterCoolerState,
      this.historyFileJSON.targetHeaterCooler_state
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  async temperaturePoll(update: boolean) {
    const jsonBody = JSON.stringify({
      req: 'getCurrentTemp',
      token: this.token,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.currentHeaterCooler_temp =
      Math.round(response.temp * 100) / 100; //connvert

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.historyFileJSON.currentHeaterCooler_temp
    );

    if (update)
      this.service
        .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
        .updateValue(this.historyFileJSON.currentHeaterCooler_temp);

    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  handleCurrentTemperatureGet() {
    return this.historyFileJSON.currentHeaterCooler_temp; //convert
  }

  async handleRotationSpeedGet() {
    return this.historyFileJSON.rotation_speed;
  }

  async handleRotationSpeedSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setRotationSpeed',
      token: this.token,
      fanSpeed: value,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.rotation_speed = response.fanSpeed;

    this.service.updateCharacteristic(
      this.platform.Characteristic.RotationSpeed,
      this.historyFileJSON.rotation_speed
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  async handleSwingModeGet() {
    return this.historyFileJSON.swing_mode;
  }

  async handleSwingModeSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setSwingMode',
      token: this.token,
      swingMode: value,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.swing_mode = response.swingMode;

    this.service.updateCharacteristic(
      this.platform.Characteristic.SwingMode,
      this.historyFileJSON.swing_mode
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  async handleTurboGet() {
    return this.historyFileJSON.turbo_state;
  }

  async handleTurboSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setTurbo',
      token: this.token,
      turboMode: value,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.turbo_state = response.turboMode;

    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.historyFileJSON.turbo_state
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  async handleLockPhysicalControlsGet() {
    return this.historyFileJSON.lockPhysicalControls_state;
  }

  async handleLockPhysicalControlsSet(value) {
    const jsonBody = JSON.stringify({
      req: 'setLockPhysicalControls',
      token: this.token,
      led: value == 1 ? true : false,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));
    this.historyFileJSON.lockPhysicalControls_state = response.led;

    this.service.updateCharacteristic(
      this.platform.Characteristic.LockPhysicalControls,
      this.historyFileJSON.lockPhysicalControls_state
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  handleTemperatureDisplayUnitsGet() {
    return this.historyFileJSON.units;
  }

  handleTemperatureDisplayUnitsSet(value) {
    this.historyFileJSON.units = value;
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }

  async handleCoolingThresholdTemperatureGet() {
    return this.historyFileJSON.coolingThresholdTemperature; //convert
  }

  handleHeatingThresholdTemperatureGet() {
    return this.historyFileJSON.heatingThresholdTemperature; //convert
  }

  async handleCoolingThresholdTemperatureSet(value) {
    this.historyFileJSON.coolingThresholdTemperature = value; //convert
    const jsonBody = JSON.stringify({
      req: 'setACTemp',
      token: this.token,
      temp: value,
    });

    await this.sendJSON(jsonBody);

    this.service.updateCharacteristic(
      this.platform.Characteristic.CoolingThresholdTemperature,
      this.historyFileJSON.coolingThresholdTemperature
    );
    this.writeConfigHistory(JSON.stringify(this.historyFileJSON));
  }
  //TODO
  handleHeatingThresholdTemperatureSet(value) {
    this.platform.log.debug('handleHeatingThresholdTemperatureSet ', value);
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

  async humidityPoll(update: boolean) {
    const jsonBody = JSON.stringify({
      req: 'getRelativeHumidity',
      token: this.token,
    });

    const response = JSON.parse(await this.sendJSON(jsonBody));

    this.historyFileJSON.currentHeaterCooler_relativeHumidity =
      response.humidity;

    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentRelativeHumidity,
      this.historyFileJSON.currentHeaterCooler_relativeHumidity
    );

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
