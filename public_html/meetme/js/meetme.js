var janus = null;
var mcu = null;

var myDisplayName = null;
var myRoomNumber = null;
var myID = null;

var feeds = [];
var bitrateTimer = [];

var isSpeakingId = null;

var membercount = 0;

var shortcut = null;

$(document).ready(function() {

	// fixme anton - first thing first, set window title
	window.document.title = windowTitle;
	$('#servicename').html(windowTitle);
	
	// shortcut
	shortcut = $.url(1);
	if (shortcut.length > 0) {
		$('#joinroomnow #roomnumber').val(shortcut);
		//$('#joinroomnow #join').trigger('click');
	}

	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: debugLevel, callback: function() {
		$(this).attr('disabled', true).unbind('click');

		// Make sure the browser supports WebRTC
		if(!Janus.isWebrtcSupported()) {
			bootbox.alert(labelNoWebRTC);
			return;
		}

		// fixme anton - confirm refresh
		window.onbeforeunload = function() {
			if (membercount > 0) {
				Janus.log("Confirmed unload");
				return labelRefreshWarning;
			}
		}

		// fixme anton - original janus onbeforeunload
		window.onunload = function() {
			Janus.log("Closing window");
			for(var s in Janus.sessions) {
				if(Janus.sessions[s] !== null && Janus.sessions[s] !== undefined && Janus.sessions[s].destroyOnUnload) {
					Janus.log("Destroying session " + s);
					Janus.sessions[s].destroy();
				}
			}
		}

		// Create session
		janus = new Janus({
			server: server,
			iceServers: iceServers,
			success: function() {
				// Attach to video room test plugin
				janus.attach({
					plugin: "janus.plugin.videoroom",
					success: function(pluginHandle) {
						mcu = pluginHandle;
						Janus.log("Plugin attached! (" + mcu.getPlugin() + ", id=" + mcu.getId() + ")");
						Janus.log("  -- This is a publisher/manager");
						$('#joinroom').removeClass('hide').show();
						$('#joinroomnow').removeClass('hide').show();
						$('#join').click(joinRoomNumber);
						$('#displayname').focus();
					},
					error: function(error) {
						Janus.error("  -- Error attaching plugin...", error);
						bootbox.alert("Error attaching plugin... " + error);
					},
					consentDialog: function(on) {
						// fixme anton - no need
					},
					onmessage: function(msg, jsep) {
						Janus.debug(" ::: Got a message (publisher) :::");
						Janus.debug("message: "+JSON.stringify(msg));
						var event = msg["videoroom"];
						Janus.debug("Event: " + event);
						if(event != undefined && event != null) {
							if(event === "joined") {
								// Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
								myID = msg["id"];
								Janus.log("Successfully joined room " + msg["room"] + " with ID " + myID);
								publishOwnFeed(true);
								// Any new feed to attach to?
								if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
									var list = msg["publishers"];
									Janus.debug("Got a list of available publishers/feeds:");
									Janus.debug(list);
									for(var f in list) {
										var id = list[f]["id"];
										var display = list[f]["display"];
										Janus.debug("  >> [" + id + "] " + display);
										newRemoteFeed(id, display)
									}
								}
							} else if(event === "destroyed") {
								// The room has been destroyed
								Janus.warn("The room has been destroyed!");
								bootbox.alert(error, function() {
									membercount = 0;
									window.location.reload();
								});
							} else if(event === "event") {
								// Any new feed to attach to?
								if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
									var list = msg["publishers"];
									Janus.debug("Got a list of available publishers/feeds:");
									Janus.debug(list);
									for(var f in list) {
										var id = list[f]["id"];
										var display = list[f]["display"];
										Janus.debug("  >> [" + id + "] " + display);
										newRemoteFeed(id, display)
									}
								} else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
									// One of the publishers has gone away?
									var leaving = msg["leaving"];
									Janus.log("Publisher left: " + leaving);
									var remoteFeed = null;
									for(var i=1; i<maxVideoBox; i++) {
										if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == leaving) {
											remoteFeed = feeds[i];
											break;
										}
									}
									if(remoteFeed != null) {
										Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
										$('#remote'+remoteFeed.rfindex).empty().hide();
										$('#videoremote'+remoteFeed.rfindex).empty();
										feeds[remoteFeed.rfindex] = null;
										remoteFeed.detach();
									}
								} else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
									// One of the publishers has unpublished?
									var unpublished = msg["unpublished"];
									Janus.log("Publisher left: " + unpublished);
									if(unpublished === 'ok') {
										// That's us
										mcu.hangup();
										return;
									}
									var remoteFeed = null;
									for(var i=1; i<maxVideoBox; i++) {
										if(feeds[i] != null && feeds[i] != undefined && feeds[i].rfid == unpublished) {
											remoteFeed = feeds[i];
											break;
										}
									}
									if(remoteFeed != null) {
										Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") has left the room, detaching");
										$('#remote'+remoteFeed.rfindex).empty().hide();
										$('#videoremote'+remoteFeed.rfindex).empty();
										feeds[remoteFeed.rfindex] = null;
										remoteFeed.detach();
									}
								} else if(msg["error"] !== undefined && msg["error"] !== null) {
									bootbox.alert(msg["error"], function () {
										membercount = 0;
										window.location.reload();
									});
								}
							}
						}
						if(jsep !== undefined && jsep !== null) {
							Janus.debug("Handling SDP as well...");
							Janus.debug(jsep);
							mcu.handleRemoteJsep({jsep: jsep});
						}
					},
					onlocalstream: function(stream) {
						Janus.debug(" ::: Got a local stream :::");
						Janus.debug(JSON.stringify(stream));
						$('#videolocal').empty();
						$('#meetmenav').hide();
						$('#joinroom').hide();
						$('#videos').removeClass('hide').show();
						$('#chat-box').removeClass('hide').show();
						if($('#myvideo').length === 0) {
							$('#videolocal').append('<video class="videobox rounded centered" id="myvideo" width="'+videoBoxWidth+'" height="'+videoBoxHeight+'" autoplay muted="muted"/>');
							// Add a 'displayname' label
							$('#videolocal').append('<span class="label label-info" id="displayname" style="position: absolute; top: 7px; left: 7px;">'+myDisplayName+'</span>');
							// Add an 'unpublish' button
							$('#unpublish').removeClass('hide').html(labelStopPublishing).click(unpublishOwnFeed);
							// Add a 'mute' button
							$('#mute').removeClass('hide').append(labelMuteOn).click(toggleMute)
							// Add a 'pause' button
							$('#pause').removeClass('hide').append(labelPauseOn).click(togglePause)
							// fixme anton - starts muted
							toggleMute();
							// Add welcome notif
							$('#roomdesc').removeClass().addClass('label label-default').html(labelRoomNumber+myRoomNumber);
							// set publisher video as large video
							setLargeVideo('videolocal');
						}
						// $('#publisher').removeClass('hide').html(myDisplayName).show();
						attachMediaStream($('#myvideo').get(0), stream);
						$("#myvideo").get(0).muted = "muted";
						var videoTracks = stream.getVideoTracks();
						if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
							// No webcam
							$('#myvideo').hide();
							$('#videolocal').append('<div class="videobox-novideo">'+labelNoWebcam+'</div>');
						}
						membercount++;
						// fixme anton - dont flash on localstream it will obstruct flashes on remotestream
						//flashTitle(membercount);
					},
					ondataopen: function(data) {
						Janus.log("The DataChannel is available!");
						$("#statusDataChannel").html("Ready");
						
						$('#chat-box').show();
					},
					onremotestream: function(stream) {
						// The publisher stream is sendonly, we don't expect anything here
					},
					oncleanup: function() {
						Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
						// fixme anton - just reload the window
						membercount = 0;
						window.location.reload();
						//membercount--;
						//flashTitle(membercount);
						//$('#videolocal').html('<div id="restartbox"><span class="label label-success" id="displayname" style="position: absolute; top: 7px; left: 7px;">'+myDisplayName+'</span><br /><button class="btn btn-info btn-xs" id="publish" style="position: absolute; top: 7px; right: 7px;">'+labelStartPublishing+'</button</div>');
						//$('#publish').click(function() {
						//	publishOwnFeed(true);
						//});
					}
				});
			},
			error: function(error) {
				Janus.error(error);
				bootbox.alert(error, function() {
					membercount = 0;
					window.location.reload();
				});
			},
			destroyed: function() {
				membercount = 0;
				window.location.reload();
			}
		})
	}})
})

function setLargeVideo(clickedId){
	if (clickedId == isSpeakingId) {
		return false;
	}
	
	var speakingVideo = $('#videofocus').html();
	var clickedVideo = $('#'+clickedId).html();
	
	$('#videofocus').html(clickedVideo);
	$('#'+clickedId).html(labelSpeaking);
	
	if (!(isSpeakingId == "undefined" || isSpeakingId == null)) {
		$('#'+isSpeakingId).html(speakingVideo);
	}
	
	isSpeakingId = clickedId;
	
	$('#videolocal video').attr('width', videoBoxWidth);
	$('#videolocal video').attr('height', videoBoxHeight);
	for(var i=1;i <= (maxVideoBox-1);i++){
		$('#videoremote'+i+' video').attr('width', videoBoxWidth);
		$('#videoremote'+i+' video').attr('height', videoBoxHeight);
	}
	$('#'+clickedId+' img').attr('width', videoBoxWidth);
	$('#'+clickedId+' img').attr('height', videoBoxHeight);
	$('#videofocus video').attr('width', videoBoxLargeWidth);
	$('#videofocus video').attr('height', videoBoxLargeHeight);
}

function checkRoomNumber(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		joinRoomNumber();
		return false;
	} else {
		return true;
	}
}

function joinRoomNumber() {
	if($('#displayname').length === 0) {
		$('#join').click(joinRoomNumber);
		$('#displayname').focus();
	} else if($('#roomnumber').length === 0) {
		$('#join').click(joinRoomNumber);
		$('#roomnumber').focus();
	} else {
		$('#displayname').attr('disabled', true);
		$('#roomnumber').attr('disabled', true);
		$('#join').attr('disabled', true).unbind('click');

		var displayName = $('#displayname').val();
		var roomNumber = $('#roomnumber').val();

		if(displayName === "") {
			$('#notifbox')
				.removeClass().addClass('label label-danger')
				.html(labelDisplayName);
			$('#displayname').removeAttr('disabled');
			$('#roomnumber').removeAttr('disabled');
			$('#join').removeAttr('disabled').click(joinRoomNumber);
			return;
		} else if (roomNumber === "") {
			$('#notifbox')
				.removeClass().addClass('label label-danger')
				.html(labelEnterRoom);
			$('#displayname').removeAttr('disabled');
			$('#roomnumber').removeAttr('disabled');
			$('#join').removeAttr('disabled').click(joinRoomNumber);
			return;
		}

		if(/[^A-Za-z0-9\s_-]/.test(displayName)) {
			$('#notifbox')
				.removeClass().addClass('label label-danger')
				.html(labelDisplayNameAlphanumeric);
			$('#displayname').removeAttr('disabled');
			$('#roomnumber').removeAttr('disabled');
			$('#join').removeAttr('disabled').click(joinRoomNumber);
			return;
		}

		if(/[^0-9]/.test(roomNumber)) {
			$('#notifbox')
				.removeClass().addClass('label label-danger')
				.html(labelRoomNumericOnly);
			$('#displayname').removeAttr('disabled');
			$('#roomnumber').removeAttr('disabled');
			$('#join').removeAttr('disabled').click(joinRoomNumber);
			return;
		}

		myRoomNumber = parseInt(roomNumber);
		if (myRoomNumber < 1 || myRoomNumber > 9999999999) {
			$('#notifbox')
				.removeClass().addClass('label label-danger')
				.html(labelInvalidRoomNumber);
			$('#displayname').removeAttr('disabled');
			$('#roomnumber').removeAttr('disabled');
			$('#join').removeAttr('disabled').click(joinRoomNumber);
			return;
		}
		
		var create = { "request": "create", "token": "", "room": myRoomNumber, "ptype": "publisher", "description": labelRoomNumber+myRoomNumber, "publishers": maxVideoBox, "bitrate": maxBitRate, "audiocodec": audioCodec, "videocodec": videoCodec, "is_private": true };
		Janus.debug("Create room request");
		mcu.send({
			"message": create, 
			success: function(resp) {
				if (resp.videoroom === "created") {
 					Janus.debug("New room "+myRoomNumber+" has been created");
      				} else if (resp.videoroom === "event") {
      					if (resp.error_code === 427) {
      						Janus.debug("Requested room "+myRoomNumber+" already exists");
      					}
      				}
      				myDisplayName = displayName;
				var join = { "request": "join", "token": "", "room": myRoomNumber, "ptype": "publisher", "display": displayName };
				Janus.debug("User "+myDisplayName+" join room "+myRoomNumber+" request");
				mcu.send({"message": join});
      			}
      		});
	}
}

function publishOwnFeed(useAudio) {
	// Publish our stream
	$('#publish').attr('disabled', true).unbind('click');
	mcu.createOffer({
		media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, video: defaultResolution, data: true },	// Publishers are sendonly
		trickle: true,
		success: function(jsep) {
			Janus.debug("Got publisher SDP!");
			Janus.debug(jsep);
			var publish = { "request": "configure", "token": "", "audio": useAudio, "video": true, "bitrate": maxBitRate, "audiocode": audioCodec, "videocodec": videoCodec };
			mcu.send({"message": publish, "jsep": jsep});
		},
		error: function(error) {
			Janus.error("WebRTC error:", error);
			if (useAudio) {
				 publishOwnFeed(false);
			} else {
				bootbox.alert("WebRTC error... " + JSON.stringify(error));
				$('#publish').removeAttr('disabled').click(function() { publishOwnFeed(true); });
			}
		}
	});
}

function unpublishOwnFeed() {
	// Unpublish our stream
	bootbox.confirm(labelConfirmExit, function(result) {
		if (result) {
			$('#unpublish').attr('disabled', true).unbind('click');
			var unpublish = { "request": "unpublish", "token": "" };
			mcu.send({"message": unpublish});
			// fixme anton - reload window after cleanup
			//membercount = 0;
			//window.location.reload();
		}
	});
}

function toggleMute() {
	var muted = mcu.isAudioMuted();
	Janus.log((muted ? "Unmuting" : "Muting") + " audio local stream...");
	if(muted) {
		mcu.unmuteAudio();
	} else {
		mcu.muteAudio();
	}
	muted = mcu.isAudioMuted();
	
	if (muted) {
		$('#mute').removeClass('btn-info').addClass('btn-danger').html(labelMuteOff);
	} else {
		$('#mute').removeClass('btn-danger').addClass('btn-info').html(labelMuteOn);
	}
}

function togglePause() {
	var muted = mcu.isVideoMuted();
	Janus.log((muted ? "Unmuting" : "Muting") + " video local stream...");
	if(muted) {
		mcu.unmuteVideo();
	} else {
		mcu.muteVideo();
	}
	muted = mcu.isVideoMuted();

	if (muted) {
		$('#pause').removeClass('btn-info').addClass('btn-danger').html(labelPauseOff);
	} else {
		$('#pause').removeClass('btn-danger').addClass('btn-info').html(labelPauseOn);
	}
}

function flashTitle(count) {
	window.document.title = "("+count+") "+windowTitle;
	$.titleAlert(windowTitle, {interval:700, duration:7000, requireBlur:false});
}

function newRemoteFeed(id, display) {
	// A new feed has been published, create a new plugin handle and attach to it as a listener
	var remoteFeed = null;
	janus.attach({
		plugin: "janus.plugin.videoroom",
		success: function(pluginHandle) {
			remoteFeed = pluginHandle;
			Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
			Janus.log("  -- This is a subscriber");
			// We wait for the plugin to send us an offer
			var listen = { "request": "join", "token": "", "room": myRoomNumber, "ptype": "listener", "feed": id };
			remoteFeed.send({"message": listen});
		},
		error: function(error) {
			Janus.error("  -- Error attaching plugin...", error);
			bootbox.alert("Error attaching plugin... " + error);
		},
		onmessage: function(msg, jsep) {
			Janus.debug(" ::: Got a message (listener) :::");
			Janus.debug(JSON.stringify(msg));
			var event = msg["videoroom"];
			Janus.debug("Event: " + event);
			if(event != undefined && event != null) {
				if(event === "attached") {
					// Subscriber created and attached
					for(var i=1;i<maxVideoBox;i++) {
						if(feeds[i] === undefined || feeds[i] === null) {
							feeds[i] = remoteFeed;
							remoteFeed.rfindex = i;
							break;
						}
					}
					remoteFeed.rfid = msg["id"];
					remoteFeed.rfdisplay = msg["display"];
					Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfdisplay + ") in room " + msg["room"]);
					$('#remote'+remoteFeed.rfindex).removeClass('hide').html(remoteFeed.rfdisplay).show();
				} else if(msg["error"] !== undefined && msg["error"] !== null) {
					bootbox.alert(msg["error"]);
				} else {
					// What has just happened?
				}
			}
			if(jsep !== undefined && jsep !== null) {
				Janus.debug("Handling SDP as well...");
				Janus.debug(jsep);
				// Answer and attach
				remoteFeed.createAnswer({
					jsep: jsep,
					media: { audioSend: false, videoSend: false, video: defaultResolution, data: true },	// We want recvonly audio/video
					trickle: true,
					success: function(jsep) {
						Janus.debug("Got SDP!");
						Janus.debug(jsep);
						var body = { "request": "start", "token": "", "room": myRoomNumber };
						remoteFeed.send({"message": body, "jsep": jsep});
					},
					error: function(error) {
						Janus.error("WebRTC error:", error);
						bootbox.alert("WebRTC error... " + JSON.stringify(error));
					}
				});
			}
		},
		onlocalstream: function(stream) {
			// The subscriber stream is recvonly, we don't expect anything here
		},
		ondata: function(data) {
			appendNewChat(data, "IN");
		},
		onremotestream: function(stream) {
			Janus.debug("Remote feed #" + remoteFeed.rfindex);
			if($('#remotevideo'+remoteFeed.rfindex).length === 0) {
				// No remote video yet
				$('#videoremote'+remoteFeed.rfindex).append('<video class="videobox rounded centered" id="remotevideo' + remoteFeed.rfindex +'" width="'+videoBoxWidth+'" height="'+videoBoxHeight+'" autoplay/>');
			}
			$('#videoremote'+remoteFeed.rfindex).append(
				// Add a 'displayname' label
				'<span class="label label-success" id="displayname" style="position: absolute; top: 7px; left: 7px;">'+remoteFeed.rfdisplay+'</span>' +
				'<span class="label label-default hide" id="curres'+remoteFeed.rfindex+'" style="position: absolute; bottom: 7px; left: 7px;"></span>' +
				'<span class="label label-default hide" id="curbitrate'+remoteFeed.rfindex+'" style="position: absolute; bottom: 7px; right: 7px;"></span>');
			$("#remotevideo"+remoteFeed.rfindex).bind("playing", function () {
				$('#remotevideo'+remoteFeed.rfindex).removeClass('hide');
				var width = this.videoWidth;
				var height = this.videoHeight;
				$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
				if(webrtcDetectedBrowser == "firefox") {
					// Firefox Stable has a bug: width and height are not immediately available after a playing
					setTimeout(function() {
						var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
						var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
						$('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
					}, 2000);
				}
				if(webrtcDetectedBrowser == "chrome" || webrtcDetectedBrowser == "firefox") {
					$('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
					bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
						// Display updated bitrate, if supported
						var bitrate = remoteFeed.getBitrate();
						$('#curbitrate'+remoteFeed.rfindex).text(bitrate);
					}, 1000);
				}
			});
			attachMediaStream($('#remotevideo'+remoteFeed.rfindex).get(0), stream);
			var videoTracks = stream.getVideoTracks();
			if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0 || videoTracks[0].muted) {
				// No remote video
				$('#remotevideo'+remoteFeed.rfindex).hide();
				$('#videoremote'+remoteFeed.rfindex).append('<div class="videobox-novideo">'+labelNoRemoteVideo+'</div>');
			}

			appendNewChat(remoteFeed.rfdisplay + labelUserJoinChat, "NOTIFICATION");
			
			membercount++;
			flashTitle(membercount);
		},
		oncleanup: function() {
			Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
			$('#curbitrate'+remoteFeed.rfindex).remove();
			$('#curres'+remoteFeed.rfindex).remove();
			if(bitrateTimer[remoteFeed.rfindex] !== null && bitrateTimer[remoteFeed.rfindex] !== null) {
				clearInterval(bitrateTimer[remoteFeed.rfindex]);
			}
			bitrateTimer[remoteFeed.rfindex] = null;

			// fixme anton - if this is the currently speaking one then set videolocal
			if (isSpeakingId == 'videoremote'+remoteFeed.rfindex) {
				$('#videofocus').empty();
				setLargeVideo('videolocal');
			}

			appendNewChat(remoteFeed.rfdisplay + labelUserLeaveChat, "NOTIFICATION");
			
			membercount--;
			flashTitle(membercount);
		}
	})
}

function checkChatSend(field, event) {
	var theCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
	if(theCode == 13) {
		chatSend();
		return false;
	} else {
		return true;
	}
}

function chatSend() {
	var chatMsg = $('#chatboxinput').val();
	if (chatMsg.length > 0) {
		var dt = new Date();
		var chatTime = dt.getFullYear()+"-"+dt.getMonth()+"-"+dt.getDate()+" "+dt.getHours()+":"+dt.getMinutes()+":"+dt.getSeconds();
		var chatSender = myDisplayName;
		var chatFullMsg = "<p>" + chatMsg + "</p><time>" + chatSender + " • " + chatTime + "</time>";
		
		$('#chatboxinput').val('');
		sendMessage(chatFullMsg);
	}
}

function sendMessage(data) {
	mcu.data({
		text: data,
		error: function(reason) { bootbox.alert(reason); },
		success: function() { 
			appendNewChat(data, "OUT");
		},
	});	
}

function appendNewChat(data, status) {
	var newChat = "";
		 
	if (status == "IN") {
		newChat = "<div class='incoming-messages'>" + data + "</div>";
	} else if (status == "OUT") {
		newChat = "<div class='outgoing-messages'>" + data + "</div>";
	} else {
		newChat = "<span class='notification-messages'><i>" + data + "</i></span>"
	}	
	
	$('#chatboxcontent').append(newChat);
	$('#chatboxcontent').animate({scrollTop: $('#chatboxcontent').get(0).scrollHeight}, 2000);
	
	if(!$('.chat-box-content').is(':visible')) {
		newMessageAlert();
	}
}

function newMessageAlert() {
	$('#statusDataChannel').html(labelChatNotificationHeader);
}

function removeMessageAlert() {
	if($("#checkboxChat").is(":checked")) {
		$('#statusDataChannel').html(labelChatReady);
	}
}
