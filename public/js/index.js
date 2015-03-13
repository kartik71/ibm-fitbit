
function postIotCredentials() {
	var uname = document.getElementById('username').value;
	if(uname === '') {
		document.getElementById('echo').innerHTML = 'Please input a valid username.';
		document.getElementById('username').focus();
		return;
	}
	var pass = document.getElementById('pw').value;
  if(pass === '') {
	  document.getElementById('echo').innerHTML = 'Please enter a password.';
	  document.getElementById('pw').focus();
	  return;
  }
	document.getElementById('echo').innerHTML = '';

  //submit the user's local tz offset with the login data so we can be smart
	//about querying the user's device for which day it currently is
  var current_date = new Date();
  var gmt_offset = current_date.getTimezoneOffset() / 60;
  document.getElementById('tzoffset').value = gmt_offset;

	document.getElementById('iotcredentials').submit();

}
