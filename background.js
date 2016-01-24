/*

	Extension to check for new movies in MCA server

	Author: Arun Babu
	Date: 24/01/2016

*/

/* Global vars */
var host = "http://10.12.41.42/";
var firstTime = false;

/* Initial values for each session */
chrome.storage.local.set({
	'host':'http://10.12.41.42/',	
	'movieList':[]
});

/* Set an alarm with 15 mins as default*/
function setAlarm() {
	chrome.storage.local.get('interval',function(item) {
		var interval = 15;
		if('interval' in item)
			interval = item['interval'];

		chrome.alarms.create("checkMovies", {
			// "when":Date.now()+ (2 * 1000),
			"periodInMinutes":parseInt(interval)
		});
	});
}
setAlarm(); //start alarm now

/* Deal with firstTime loading. */
chrome.runtime.onInstalled.addListener(function(obj) {
	chrome.storage.local.set({'firstTime':true,'lastMovie':9999999});
	firstTime=true;
});


/* Check for new movies on alarm*/
chrome.alarms.onAlarm.addListener(function(alarm) {
	if(alarm.name == "checkMovies") {
		console.log("alarm fired");
		checkMCA();
	}
});

/* If uname is empty, open settings */
chrome.storage.local.get(['uname','pass'],function(items) {
	if(!('uname' in items) || items['uname'] == "") {
		chrome.storage.local.set({'uname':'','pass':''});
		chrome.tabs.create({url:'settings.html'});
		return;
	}
});

/* Initiate check for new movies*/
function checkMCA() {
	uname = chrome.storage.local.get(['uname','pass','lastMovie'], function (items) {
		
		if(!('uname' in items) || items['uname'] == "") return;
		login(items['uname'],items['pass'],items['lastMovie']);
		// getMovieList(items['lastMovie']);
	});
}

/* initiate on every start up*/
chrome.runtime.onStartup.addListener(function() {
	chrome.storage.local.get('firstTime', function(item) {
		if(item['firstTime'])
			firstTime = true;
	});
	checkMCA();
});

/* Login to MCA */
function login(uname,pass,lastMovie) {
	var xhr = new XMLHttpRequest();
	xhr.open("POST", host + "login.php", true);
	xhr.onreadystatechange = function() {
	  if (xhr.readyState == 4) {
	    if( xhr.responseText.indexOf('id="error"') != -1 ) {
			// alert('MCA login not successfull!');
			chrome.notifications.create('loginerror', {
					type:"basic",
					iconUrl:'icon.png',
					title:'Cannot login to MCA!',
					message: "Provided username and password might be wrong!",					
				});
	  	} else {
	  		//succesfull login
	  		getMovieList(lastMovie);
	  	}
	  }
	}
	xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
	xhr.send("username="+uname+"&password="+pass);
}

/* Parse movies page to get movies list*/
function getMovieList(lastMovie) {
	var xhr = new XMLHttpRequest();
	xhr.open("GET", host+"movies.php", true);

	xhr.onreadystatechange = function() {
	  if (xhr.readyState == 4) {
		var movieList = [];
	    var res = document.createElement('div');
	    res.innerHTML = xhr.responseText;
	    var moviesList = res.querySelectorAll('#movies > ul > li');

	    if(moviesList.length < 1) {
	    	console.log(xhr.responseText);
	    	return;
	    }

	    var latestMovie = -1;
		for (var i = 0; i < moviesList.length; i++) {
			var link = moviesList[i].childNodes[0].href;
			var id = link.slice(link.indexOf('movie_id=')+9);
			var thumb = moviesList[i].childNodes[0].childNodes[0].src;
			var name = moviesList[i].childNodes[1].innerText;
			var imdb = moviesList[i].childNodes[2].innerText;

			thumb = thumb.slice(thumb.indexOf('movies/'));
			link = link.slice(link.indexOf('moviehomepage.php'));

			if(latestMovie == -1) latestMovie = parseInt(id);

			if(firstTime || parseInt(id) > lastMovie) { 
				//show notification for latest movie for first time
				chrome.notifications.create(id, {
					type:"image",
					iconUrl:'icon.png',
					title:moviesList[i].childNodes[1].innerText,
					message:  "New movie uploaded in MCA\n" + imdb,
					imageUrl: host+thumb
				});

				if(parseInt(id) > latestMovie)
					latestMovie = parseInt(id);

				firstTime = false;
			}

			//generate movie list
			movieList.push({
				id : id,
				name: name,
				link: link,
				thumb: thumb,
				imdb: imdb
			});
		}

		/*	store last movie and disable first time*/
		chrome.storage.local.set({'lastMovie':latestMovie,'firstTime':false});

		// console.log(movieList);
		chrome.storage.local.set({'movieList':[]});
		chrome.storage.local.set({'movieList':movieList});
	  }
	}
	xhr.send();
}

/*Open correspinding movie when notification is clicked*/
chrome.notifications.onClicked.addListener(function(id) {
	if(id !== "loginerror")
		chrome.tabs.create({url:host+"moviehomepage.php?movie_id="+id});
	chrome.notifications.clear(id);
});

/* respond to msgs from other parts*/
sendr = function() {}
chrome.runtime.onMessage.addListener(function(msg,sender,sendr) {
	if(msg.msg == "checkMovies"){
		checkMCA();
	}
	if(msg.msg == "updateAlarm") {
		setAlarm();
		checkMCA();
	}
});