/**
 * Created by godsong on 15-9-23.
 */
var express=require('express');
var compression=require('compression');

var app=express();
app.use(compression());
app.use(express.static(__dirname+'/assets'));
app.listen(7777);
