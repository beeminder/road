<?php
# Serves as a webserver for Beebrain. Not currently used.

$slug   = $_REQUEST['slug'];
$params = $_REQUEST['params'];
$data   = $_REQUEST['data'];

if(!isset($slug) && !isset($params) && !isset($data)) {
  header('Location: http://beeminder.com/api');
  exit(0);
}

if(json_decode($params)===null || json_decode($data)===null) {
  echo '{"error":"Malformed parameters given to Beebrain."}';
  exit(1);
}

unlink("nonce/$slug.json");
file_put_contents("nonce/$slug.bb", "{\"params\":$params, \"data\":$data}");
while(!file_exists("nonce/$slug.json")) sleep(1);
#header('Content-type: text/json');
echo file_get_contents("nonce/$slug.json");

?>
