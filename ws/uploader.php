<?php

    include 'credentials.php';

    // Result object
    $r = new stdClass();
    // no-cache (important for mobile safari)
    header('cache-control: no-cache');
    // Result content type
    header('content-type: application/json');

    // File size control
    $maxsize = 1; //Mb
    if ($_FILES['photo_input']['size'] > ($maxsize * 1048576)) {
        $r->error = "Error: Max file size: $maxsize Mb";
        return false;
    }

    // Supporting image file types
    $types = Array('image/png', 'image/gif', 'image/jpeg');
    // File type control
    if (in_array($_FILES['photo_input']['type'], $types)) {
        // Create an unique file name    
        $filename = 'uploads/' . uniqid() . '.jpg';
        // Uploaded file source
        file_put_contents($filename, file_get_contents($_FILES["photo_input"]["tmp_name"]));

        // Variables for Imgur upload
        $handle = fopen($filename, "r");
        $data = fread($handle, filesize($filename));
        $pvars   = array('image' => base64_encode($data));
        $timeout = 30;

        // cURL configuration
        $curl = curl_init();
        curl_setopt($curl, CURLOPT_URL, 'https://api.imgur.com/3/image.json');
        curl_setopt($curl, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($curl, CURLOPT_HTTPHEADER, array('Authorization: Client-ID ' . $client_id));
        curl_setopt($curl, CURLOPT_POST, 1);
        curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($curl, CURLOPT_POSTFIELDS, $pvars);
        $out = curl_exec($curl);
        curl_close ($curl);

        // Response from Imgur API
        $pms = json_decode($out,true);
        $url=$pms['data']['link'];
        if($url!=""){
            $r->message = 'Upload successful';
            $r->url_imgur = $url;
        }else{
            $r->message = 'Upload unsuccessful';
            $r->error = $pms['data']['error'];
            return false;
        } 

    } else {
        // If the file is not an image
        $r->error = "Error: this image file type is not accepted (not jpeg, png nor gif).";
        return false;
    }

    // File path
    $path = "http://" . $_SERVER['SERVER_NAME'] . str_replace( basename($_SERVER['PHP_SELF']) , '', $_SERVER['REQUEST_URI'] );

    // Result data
    $r->url_local = $path . $filename;

    // Insert a record in CartoDB's observation table, linking the feature and the photo
    // Building a JSON object out of form data received
    $credit = '';
    if (isset($_REQUEST['text_input']))
    {
        $credit = $_REQUEST['text_input'];
    }
    $form_data_json = json_encode(array('photo'=>$r->url_imgur,'credit'=>$credit));

    // Create an observation
    $sql = "INSERT INTO fc_observations(the_geom,form_data,feature_id,dataset_id,date_time) VALUES (ST_Transform(ST_SetSRID(ST_MakePoint(".$_REQUEST['map_view_x'].",".$_REQUEST['map_view_y']."),900913),4326),'".$form_data_json."',".$_REQUEST['feature_id'].",'".$_REQUEST['dataset_id']."',CURRENT_TIMESTAMP(2)) RETURNING cartodb_id";
    $r->observation_sql = $sql;
    // Initializing curl
    $ch = curl_init( "https://".$cartodb_username.".cartodb.com/api/v2/sql" );
    $query = http_build_query(array('q'=>$sql,'api_key'=>$cartodb_api_key));
    // Configuring curl options
    curl_setopt($ch, CURLOPT_POST, TRUE);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $query);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, TRUE);
    $result_not_parsed = curl_exec($ch);
    $result = json_decode($result_not_parsed);
    // Observation ID
    $r->observation_id = $result->rows[0]->cartodb_id;

    // TODO: for all form fields, create an observation snippet to do this?

    // Return to JSON
    echo json_encode($r);

?>
