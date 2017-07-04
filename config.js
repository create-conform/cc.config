/////////////////////////////////////////////////////////////////////////////////////////////
//
// cc.io.volume.config
//
//    Module that will mount a local volume for storing configuration.
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
    this.MAX_SIZE = ls? ls.MAX_SIZE : "5242880";

    this.ConfigurationVolume = function(mod, root) {
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

        this.open = function(path, opt_access) {
            return mod.uri.open(root + path, opt_access);
        };

        this.events = new event.Emitter(this);
    };
    this.ConfigurationVolume.prototype = io.Volume;

    var volume;

    define.wait(function(resolve, reject) {
        function tryLocalStorage() {
            // secondly try local storage
            if (!volume && ls) {
                volume = new self.ConfigurationVolume(ls, "ls:///");
                done();
                return;
            }
        }
        function done() {
            if (volume) {
                io.volumes.register(volume);
                resolve();
                return;
            }
            reject("The runtime does not support saving persistent configuration.");
        }

        // first try file system
        if (fs) {
            var path;
            switch(host.platform) {
                case host.PLATFORM_MACOS:
                    path = PATH_CONFIG_USER_MACOS;
                    break;
                case host.PLATFORM_WINDOWS:
                    path = PATH_CONFIG_USER_WINDOWS;
                    break;
            }
            if (host.isPlatformLinuxFamily()) {
                path = PATH_CONFIG_USER_LINUX;
            }
            fs.uri.exists(path).then(function() {
                volume = new self.ConfigurationVolume(fs, path);
                done();
            }, function(e) {
                console.error("Configuration volume path not accessible!", e);
                tryLocalStorage();
            });
        }
        else {
            tryLocalStorage();
        }
    });
}

var singleton;
define(function() {
    if (!singleton) {
        singleton = new (Function.prototype.bind.apply(Config, arguments));
    }
    return singleton;
});

// create instance on define
define.cache.get().factory();