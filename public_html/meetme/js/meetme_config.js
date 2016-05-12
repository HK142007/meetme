var server = "wss://meetme.id/gateway";
var iceServers = [
	{urls: "stun:stun.meetme.id:443"},
	{urls: "turn:turn.meetme.id:443?transport=tcp", credential: "meetme", username: "meetme"}
];
var videoBoxWidth = 160;
var videoBoxHeight = 120;
var videoBoxLargeWidth = "100%";
var videoBoxLargeHeight = "auto";
var maxVideoBox = 16;
var maxBitRate = 64000;
var defaultResolution = "lowres";	// lowres, stdres, hires
var debugLevel = "all"
var audioCodec = "opus";
var videoCodec = "vp8";
var windowTitle = "meetme.id";
var sideTabURL = "https://meetme.id/wb/meetmeboard";
