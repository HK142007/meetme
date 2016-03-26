# meetme

WebRTC online meeting room. Powered by Janus WebRTC gateway.

Item       | Data
---------- | ----------------------------------------
Maintainer | [Anton Raharja](http://antonraharja.com)
License    | [MIT License](LICENSE.md)

# Changelog

Changes up to today:

- Modification of videoroom plugin demo web app
- Add dynamic room creation
- Add labels for easy translation
- Add a large video box and small video boxes
- Early work on enhancing the user interface

# Usage

Live example of this project is [meetme.id](https://meetme.id).
Enter your name and room number, click the join button and share the room number with your friends to start the video conference.

# Installation

Installation steps:

- Drop all files in `public_html` to your own web document root or folder
- Make sure that the server has HTTPS enabled
- Modify source codes, mainly `index.html`, `meetme.css` and `meetme*.js`, as you wish
- Do not touch janus.js and other js files other than `meetme*.js` unless you know what you're doing

Please note:

- You do not need to always use [meetme.id](https://meetme.id) infrastructure, you can install [Janus WebRTC Gateway](https://janus.conf.meetecho.com/) on your server and use it instead
- You also don't need to use STUN/TURN if your Janus server is not in the Internet and not serving clients over the Internet, comment `iceServers` option on `meetme_config.js`
