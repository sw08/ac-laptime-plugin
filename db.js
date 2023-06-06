const mysql = require('mysql');
const fs = require('fs');
const config = require('./config');
const tools = require('./tools');

class Car {
    constructor(db, options={}) {
        Object.assign(this, {
            driver_guid: undefined,
            best: undefined,
            name: undefined,
            laps: undefined
        });
        Object.assign(this, options);
        if (this.driver_guid) {
            db.fetchPersonalBest(this.driver_guid, (laptime) => {
                this.best = laptime;
            });
            db.fetchParticipant(this.driver_guid, (data) => {
                this.laps = data.length > 0 ? data.laps : 0;
            });
        }
    }
    completeLap () {
        this.laps++;
    }
}

class DB {
    constructor(model, count) {
        this.model = model
        this.cars = {}
        for (var i = 0; i < count; i++) {
            this.reset(i);
        }
        this.conn = mysql.createConnection(config.db);
        this.conn.connect();
        this.conn.query('create table if not exists participant(guid char(17) primary key, name varchar(30), laps smallint unsigned)');
        this.conn.query('create table if not exists trackbest(guid char(17), laptime mediumint unsigned, laps tinyint)');
        this.conn.query('create table if not exists personalbest(guid char(17) primary key, laptime mediumint unsigned, laps tinyint unsigned)');
        this.fetchTrackBest();
    }
    reset (car_id) {
        this.cars[car_id] = new Car(this);
    }
    set (key, value) {
        this[key] = value;
    }
    newCar (car_id, options) {
        this.cars[car_id.toString()] = new Car(this, options); 
    }
    getCar (car_id) {
        return this.cars[car_id.toString()];
    }
    fetchParticipant (guid, callback) {
        this.conn.query('select * from participant where guid=?', guid, (error, results, fields) => {
            callback(results);
        });
    }
    fetchPersonalBest (guid, callback) {
        this.conn.query('select laptime from personalbest where guid=?', guid, (error, results, fields) => {
            callback(results.length > 0 ? results[0].laptime : 0);
        });
    }
    fetchTrackBest () {
        this.conn.query('select * from trackbest', (error, results, fields) => {
            if (results.length === 0) {
                this.setTrackBest({
                    name: undefined,
                    laptime: 0,
                    guid: undefined
                });
            } else {
                this.fetchParticipant(results[0].guid, (data) => {
                    this.setTrackBest({
                        name: data.name,
                        laptime: results[0].laptime,
                        guid: results[0].guid
                    });
                });
            }
        });
    }
    savePersonalBest (car_id, guid, name, laps, laptime) {
        this.cars[car_id.toString()].best = laptime;
        this.conn.query('delete from personalbest where guid=?', guid);
        this.conn.query('insert into personalbest (guid, laptime, laps) values (?, ?, ?)', [guid.toString(), laptime, laps]);
        // GUID로 개인 베스트 저장
    }
    saveTrackBest (guid, name, laps, laptime) {
        this.trackbest = {guid: guid, laptime: laptime, name: name};
        this.conn.query('delete from trackbest');
        this.conn.query('insert into trackbest (guid, laptime, laps) values (?, ?, ?)', [guid.toString(), laptime, laps]);
        // GUID로 트랙 베스트 저장
    }
    saveLaps (car_id) {
        const car = this.getCar(car_id);
        if (car.laps === 0) return;
        this.conn.query('delete from participant where guid=?', guid);
        this.conn.query('insert into participant (guid, name, laps) values (?, ?, ?)', [guid.toString(), car.name, car.laps]);
    }
    setTrackBest (options) {
        this.trackbest = options;
    }
    saveAccident (car_id, other_car_id, speed, world_position, rel_position) {
        // 사고 저장
        const car = this.getCar(car_id);
        const other_car = this.getCar(other_car_id);
        fs.appendFile(
            './accident.log',
            `\n${new Date().toLocaleString('ko-kr')} ${car.name}(${car.laps} lap) vs ${other_car.name}(${other_car.laps} lap) crash at ${speed}km/h / #1 ${world_position.toString()}, #2 ${rel_position.toString()}`,
            (error) => {if (!error) console.log(error)}
        );
    }
}

module.exports = {
    DB: DB,
    Car: Car
}