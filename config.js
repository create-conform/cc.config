/////////////////////////////////////////////////////////////////////////////////////////////
//
// cc.config
//
//    Library for loading and saving configuration data.
//
// License
//    Apache License Version 2.0
//
// Copyright Nick Verlinden (info@createconform.com)
//
/////////////////////////////////////////////////////////////////////////////////////////////

function Config(pkx, module, configuration) {
    var self = this;

    var host = require("cc.host");
    var event = require("cc.event");
    var io = require("cc.io");
    var fs = require("cc.io.file-system");
    var ls = require("cc.io.local-storage");

    //
    // constants
    //
    var PROTOCOL_CONFIGURATION = "cfg";
    var PATH_CONFIG_DEVICE_LINUX = "/etc/opt/";
    var PATH_CONFIG_DEVICE_WINDOWS = typeof process != "undefined"? process.env.ProgramData + "\\" : null;
    var PATH_CONFIG_DEVICE_MACOS = "/Library/Preferences/";
    var PATH_CONFIG_USER_LINUX = typeof process != "undefined"? process.env.HOME + "/.config/" : null;
    var PATH_CONFIG_USER_WINDOWS = typeof process != "undefined"? process.env.APPDATA + "\\" : null;
    var PATH_CONFIG_USER_MACOS = typeof process != "undefined"? process.env.HOME + "/Library/Preferences/" : null;
    this.ERROR_FILE_SIZE_EXEEDS_LIMIT = "config-error-file-size-exeeds-limit";
    this.MAX_SIZE = ls? ls.MAX_SIZE : "5242880";

    //
    // private
    //
    var volume;
    var ConfigurationVolume = function(mod, root) {
        this.err = [];
        this.name = "Configuration (Local)";
        this.protocol = PROTOCOL_CONFIGURATION;
        this.description = "Contains local module configuration data.";
        this.size = self.MAX_SIZE;
        this.state = io.VOLUME_STATE_READY;
        this.type = io.VOLUME_TYPE_FIXED;
        this.scope = io.VOLUME_SCOPE_LOCAL;
        this.class = io.VOLUME_CLASS_PERSISTENT;
        this.readOnly = false;
        this.localId = "config";

        this.open = function(path, opt_access, create_path) {
            return mod.uri.open(root + path, opt_access, create_path);
        };

        this.events = new event.Emitter(this);
    };
    ConfigurationVolume.prototype = io.Volume;
    function mountConfigVolume(resolve, reject) {
        //mount config volume if not already mounted
        if (!volume) {
            tryFileSystem().then(resolve, function() {
                if (e) {
                    reject(new Error(e));
                }
                tryLocalStorage().then(resolve, function(e) {
                    reject(new Error(e || "The runtime does not support saving local configuration."));
                })
            });
        }
        else {
            resolve();
        }
    }
    function tryFileSystem() {
        return new Promise(function(resolve, reject) {
            // firstly try file system
            if (fs && fs.uri) {
                var path;
                switch(host.platform) {
                    case host.PLATFORM_MACOS:
                        path = PATH_CONFIG_USER_MACOS;
                        break;
                    case host.PLATFORM_WINDOWS:
                        path = "/" + PATH_CONFIG_USER_WINDOWS;
                        break;
                }
                if (host.isPlatformLinuxFamily()) {
                    path = PATH_CONFIG_USER_LINUX;
                }
                fs.uri.exists(path).then(function() {
                    volume = new ConfigurationVolume(fs, path);
                    resolve();
                }, function(e) {
                    reject(e);
                });
            }
            else {
                reject();
            }
        });
    }
    function tryLocalStorage() {
        return new Promise(function(resolve, reject) {
            // secondly try local storage
            if (ls && ls.uri) {
                volume = new ConfigurationVolume(ls, "ls:///");
                resolve();
            }
            else {
                reject(new Error("The runtime does not support saving local configuraration"));
            }
        });
    }

    //
    // public
    //
    this.load = function(path) {
        return new Promise(function(resolve, reject) {
            function success() {
                // load file from volume (if not exist, return blanco object)
                volume.open(path, io.ACCESS_READ, true).then(function(stream) {
                    stream.readAsJSON().then(function(obj) {
                        stream.close();
                        resolve(obj);
                    }, function(e) {
                        stream.close();
                        reject(e);
                    });
                }, reject);
            }

            if (!volume) {
                mountConfigVolume(success, reject);
            }
            else {
                success();
            }
        });
    };

    this.save = function(obj, path) {
        return new Promise(function(resolve, reject) {
            function success() {
                // save file to volume (and create folders)
                volume.open(path, io.ACCESS_MODIFY, true).then(function(stream) {
                    var data = JSON.stringify(obj);
                    if (data.length > self.MAX_SIZE) {
                        reject(new Error(self.ERROR_FILE_SIZE_EXEEDS_LIMIT, "The configuration file is too big. There is a size limit of " + self.MAX_SIZE + " bytes per file for storing local configuration data."));
                    }
                    else {
                        stream.write(data).then(function() {
                            stream.close();
                            resolve();
                        }, function(e) {
                            stream.close();
                            reject(e);
                        });
                    }
                }, reject);
            }

            if (!volume) {
                mountConfigVolume(success, reject);
            }
            else {
                success();
            }
        });
    };
}

var singleton;
define(function() {
    if (!singleton) {
        singleton = new (Function.prototype.bind.apply(Config, arguments));
    }
    return singleton;
});