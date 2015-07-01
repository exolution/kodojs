/**
 * Created by godsong on 15-3-4.
 */
var Path = require('path');
exports['404'] = function(Action) {
    Action.response.sendFile(Path.resolve(__dirname, './404.html'));

};