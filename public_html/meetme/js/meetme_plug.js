var plugURLParams;

(window.onpopstate = function () {
    var match,
        pl     = /\+/g,
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    plugURLParams = {};
    while (match = search.exec(query))
       plugURLParams[decode(match[1])] = decode(match[2]);
})();

var plugRoomId = parseInt(plugURLParams["room"]);

function plugLoadIframe(iframeName, url) {
	var $iframe = $('#' + iframeName);

	if ( $iframe.length ) {
		$iframe.attr('src',url);   

		return false;
	}

	return true;
}
