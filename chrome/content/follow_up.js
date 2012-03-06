Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

 var follow_up_ext = {
  /*This function is called when the extension loads*/
  onLoad: function() 
  {
    this.initialized = true;
	this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
	this.tagService = Components.classes["@mozilla.org/messenger/tagservice;1"].getService (Components.interfaces.nsIMsgTagService);
	this. promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	this.logFile = this.getLocalDirectory();
	this.converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
	this.converter.charset = "UTF-8";
	
	//set a timeout to prevent lag in loading.
	setTimeout(
        
		function()
		{
			//set overdue tags as pending.
			follow_up_ext.setPendingTags();
        },1000)
  },
  
  /*
  This function is called when a new follow up is to be added.
  It calls the datepicker window, creates / adds the tag to the email
  and calls the Lightning methods to create a calendar task / event
  */
  addFollowUp: function()
  {
  	if(this.isMessageSelected() == false)
  		return;
  	//open the datepicker window.
  	var params = { out: null };
    window.openDialog("chrome://follow_up_ext/content/date_dialog.xul", "", "modal", params).focus();
    //if a date was selected by the user.
    if (params.out != null) 
    {
    	var date = params.out;
    	//create the tag.
        var d;
        if(this.isValidDate(date) == true)
    	{
    		d = follow_up_calendar.FOLLOWUPSTR + date.getDate().toString() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear().toString();
    		if (!follow_up_ext.tagService.getKeyForTag(d))
        	{
        		follow_up_ext.tagService.addTag(d, "#33CC00", "");
        	}
        	ToggleMessageTag(follow_up_ext.findTagKey(d), true);
        	this.addItemtoCalendar(date,follow_up_calendar.FOLLOWUP);
    	}
    	else
    	{
    		d = follow_up_calendar.PENDINGSTR + date.getDate().toString() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear().toString();
    		if (!follow_up_ext.tagService.getKeyForTag(d))
        	{
        		follow_up_ext.tagService.addTag(d, "#FF0000", "");
        	}
        	ToggleMessageTag(follow_up_ext.findTagKey(d), true);
        	this.addItemtoCalendar(date,follow_up_calendar.PENDING);
    	}
    }
  },
  
  addItemtoCalendar : function(date,status)
  {
  	//create event / task in the calendar.
    if (follow_up_ext.prefs.getIntPref("extensions.follow_up_ext.calpref") == 0)
    {
    	follow_up_calendar.addEvent(date,status);
    }
    else
    {
    	follow_up_calendar.addTask(date,status);
    }
  },
  
  markDone: function(msgHdr, num)
  {
  	//get all the tags existing in Thunderbird.
  	var allTags = follow_up_ext.tagService.getAllTags({});
	if(num == 0){
		msgHdr = gDBView.hdrForFirstSelectedMessage;
	}
	else{
		gFolderDisplay.selectMessage(msgHdr);
		msgHdr = gDBView.hdrForFirstSelectedMessage;
	}
	
    var curKeys = msgHdr.getStringProperty("keywords");
        	
	//loop through all the tags
	for (var i = 0; i < allTags.length; i++) 
	{
		var tagname = allTags[i].tag;
		key = allTags[i].key;
		//check if it is a follow up or pending tag.
        var initial = tagname.substring(0, follow_up_calendar.difFolPen);
        if (initial == (follow_up_calendar.FOLLOWUPSTR.substring(0,follow_up_calendar.difFolPen)) )
        {
        	//if message has this particular tag.
        	if (curKeys.indexOf(key) != -1)
        	{
        		//extract the date of this tag.
        		var dateString = allTags[i].tag.substring(follow_up_calendar.difFolPen).split("/");
        		var month = parseInt(dateString[1]) - 1;
        		var date = new Date(dateString[2], month, dateString[0]);
                
                //remove the tag from the email.
                ToggleMessageTag(key, false);
                this.removeItemfromCalendar(date,follow_up_calendar.FOLLOWUP);

            }
            
        }
        if (initial == follow_up_calendar.PENDINGSTR.substring(0,follow_up_calendar.difFolPen))
        {
        	//if message has this particular tag.
        	if (curKeys.indexOf(key) != -1)
        	{
        		//extract the date of this tag.
        		var dateString = allTags[i].tag.substring(follow_up_calendar.difFolPen + 4).split("/");
        		var month = parseInt(dateString[1]) - 1;
        		var date = new Date(dateString[2], month, dateString[0]);
                
                //remove the tag from the email.
                ToggleMessageTag(key, false);
                this.removeItemfromCalendar(date,follow_up_calendar.PENDING);
            }
        }
    }
  },
  
  removeItemfromCalendar : function(date,status)
  {
  	if (follow_up_ext.prefs.getIntPref("extensions.follow_up_ext.calpref") == 0)
    {
    	follow_up_calendar.removeEvent(date,status);
    }
    else
    {
    	follow_up_calendar.removeTask(date,status);
    }
  },
  
  /*
  This function shows the follow ups for a particular date as passed it.
  It makes use of the Thunderbird Quick Filter Bar UI to display these emails.
  */
  viewFollowUp : function(date)
  {
  	//find the tag for the particular date.
  	var d = follow_up_calendar.FOLLOWUP + ": " + date.getDate().toString() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear().toString();
    var key = follow_up_ext.findTagKey(d);

    var qfb = document.getElementById("qfb-show-filter-bar");
    var qfb_status = qfb.checked;
    if (!qfb_status) 
    {
    	qfb.click();
    }
    
    var qfb_tag = document.getElementById("qfb-tags");
    var qfb_tag_status = qfb_tag.checked;
    if (!qfb_tag_status) 
    {
    	qfb_tag.click();
    }

	//set timeout for the UI elements to load.
    setTimeout(
		function () 
		{
        	var tagButton = document.getElementById("qfb-tag-" + key);
            //if no such tag element is found.
            if (tagButton == null) 
            {
                this.promptService.alert(null, follow_up_calendar.FOLLOWUP, "You have no mails to follow up!");
                ////reset the button state.
                if (!qfb_tag_status)
                {
                    qfb_tag.click();
                }
                if (!qfb_status) {
                    qfb.click();
                }
            }
			//show the filtered emails.
            tagButton.click();
        }, 1000)
  },
  
  /*
  This funtion show all the pending mails using the Thunderbird
  Quick Filter Bar.
  */
  viewPending : function()
  {
  	var pending_count = 0;
    
    var qfb = document.getElementById("qfb-show-filter-bar");
    var qfb_status = qfb.checked;
    if (!qfb_status) 
    {
        qfb.click();
    }
    
    var qfb_tag = document.getElementById("qfb-tags");
    var qfb_tag_status = qfb_tag.checked;
    if (!qfb_tag_status) 
    {
	    qfb_tag.click();
    }
    
    //get all the tags existing in thunderbird.
    var allTags = follow_up_ext.tagService.getAllTags({});

	//set timeout for the UI elements to load.
    setTimeout(
        function ()
        {
        	//check all the pending tags and set their toggle state to true.
            for (var i = 0; i < allTags.length; i++)
            {
                var tagname = allTags[i].tag;
                var initial = tagname.substring(0, follow_up_calendar.difFolPen);
                if (initial == follow_up_calendar.PENDINGSTR.substring(0,follow_up_calendar.difFolPen)) 
                {
                    pending_count++;
                    var tagButton = document.getElementById("qfb-tag-" + allTags[i].key);
                    tagButton.click();
                }
            }
            //if no pending tags found then we just display a popup message.
            if (pending_count == 0) 
            {
                this.promptService.alert(null, follow_up_calendar.FOLLOWUP, "You have no pending mails!");
                //reset the qfb state.
                if (!qfb_tag_status)
                {
                    qfb_tag.click(); 
                }
                if (!qfb_status) 
                {
                    qfb.click();
                }
            }
        }, 1000)
  },
  
  /*
  This function shows all the follow-up and the pending mails together
  using the Thunderbird Quick Filter Bar.
  */
  showAll : function()
  {
  	var all_count = 0;
    
    var qfb = document.getElementById("qfb-show-filter-bar");
    var qfb_status = qfb.checked;
    if (!qfb_status)
    {
    	qfb.click();
    }
    
    var qfb_tag = document.getElementById("qfb-tags");
    var qfb_tag_status = qfb_tag.checked;
    if (!qfb_tag_status)
    {
    	qfb_tag.click();
    }
    
    //get all tags existing in thnderbird.
    var allTags = follow_up_ext.tagService.getAllTags({});

    //set timeout to allow the UI elements to load.     
    setTimeout(
        function ()
        {
            for (var i = 0; i < allTags.length; i++) 
            {
                var tagname = allTags[i].tag;
                var initial = tagname.substring(0, follow_up_calendar.difFolPen);
                //if a follow up or pending tag exists set its toggled state to true.
                if (initial == follow_up_calendar.PENDINGSTR.substring(0,follow_up_calendar.difFolPen) || initial == (follow_up_calendar.FOLLOWUPSTR.substring(0,follow_up_calendar.difFolPen)))
                {
                    all_count++;
                    var tagButton = document.getElementById("qfb-tag-" + allTags[i].key);
                    tagButton.click();
                }
            }
            //if no tags are found simply display a message.
            if (all_count == 0)
            {
                this.promptService.alert(null, follow_up_calendar.FOLLOWUP, "You have no pending / follow up mails!");
                if (!qfb_tag_status) 
                {
                    qfb_tag.click();
                }
                if (!qfb_status)
                {
                    qfb.click();
                }
            }
        }, 1000)
  },
  
  /*This funtion finds the key of the tag whose name is passed to it*/
  findTagKey : function(tagName) 
  {
  	var res = null;
    var allTags = follow_up_ext.tagService.getAllTags({});
    for (var i = 0; i < allTags.length; i++) 
    {
    	if (allTags[i].tag == tagName) 
        {
            res = allTags[i].key;
            break;
        }
    }
    return res;
  },
  
  /*This function checks for all flags that are overdue and changes them to pending*/
  setPendingTags : function()
  {
  	var allTags = follow_up_ext.tagService.getAllTags({});
    for (var i = 0; i < allTags.length; i++) 
    {
        var tagname = allTags[i].tag;
        var initial = tagname.substring(0, follow_up_calendar.difFolPen);
        if (initial == (follow_up_calendar.FOLLOWUPSTR.substring(0,follow_up_calendar.difFolPen))) 
        {
            if (follow_up_ext.compareWithToday(tagname.substring(follow_up_calendar.difFolPen + 1)) == true) 
            {
                key = allTags[i].key;
                follow_up_ext.tagService.setTagForKey(key, follow_up_calendar.PENDINGSTR + tagname.substring(follow_up_calendar.difFolPen));
                follow_up_ext.tagService.setColorForKey(key, "#FF0000");
                
                //extract the date of this tag.
        		var dateString = allTags[i].tag.substring(follow_up_calendar.difFolPen).split("/");
        		var month = parseInt(dateString[1]) - 1;
        		var date = new Date(dateString[2], month, dateString[0]);
        		
        		//also update events to pending.
        		if (follow_up_ext.prefs.getIntPref("extensions.follow_up_ext.calpref") == 0)
    			{
    				follow_up_calendar.setEventToPending(date);
			    }
			    else
			    {
			    	follow_up_calendar.setTaskToPending(date);
			    }	
            }
        }
    }
  },
  
  /*This function clears unused follow-up / pending tags that are no longer attached to any emails*/
  clearUnusedTags : function() 
  {
  	var qfb = document.getElementById("qfb-show-filter-bar");
    var qfb_status = qfb.checked;
    if (!qfb_status) 
    {
        qfb.click();
    }

    var qfb_tag = document.getElementById("qfb-tags");
    var qfb_tag_status = qfb_tag.checked;
    if (!qfb_tag_status) 
    {
        qfb_tag.click();
    }

	//set timeout to load the UI elements.
    setTimeout(

    function () 
    {
        var allTags = follow_up_ext.tagService.getAllTags({});
        var key;
        for (var i = 0; i < allTags.length; i++)
        {
            var tagname = allTags[i].tag;
            var initial = tagname.substring(0, follow_up_calendar.difFolPen);
            if (initial == (follow_up_calendar.FOLLOWUPSTR.substring(0,follow_up_calendar.difFolPen)) || initial == follow_up_calendar.PENDINGSTR.substring(0,follow_up_calendar.difFolPen)) 
            {
                key = allTags[i].key;
                var tagButton = document.getElementById("qfb-tag-" + key);
                if (tagButton == null)
                {
                    follow_up_ext.tagService.deleteKey(key);
                }
            }
        }
        if (!qfb_tag_status)
        {
            qfb_tag.click();
        }
        if (!qfb_status) 
        {
            qfb.click();
        }
    }, 1000)
  },
  
  isMessageSelected : function()
  {
  	try
  	{
  		var msgHdr = gDBView.hdrForFirstSelectedMessage;
    }
    catch (e)
    {
    	return false;
    }
    return true;
  },
  isValidDate : function(date)
  {
  	var yesterday = new Date();
  	yesterday.setDate(yesterday.getDate()-1);
  	if(date < yesterday)
  	{
  		return false;
  	}
  	return true;
  },
  /*This functions checks if the date is older than todays date and returns true if it is so*/
  compareWithToday : function(dateRef) 
  {
  	var arr = dateRef.split("/");
    var now = new Date();
    var date = new Date(now.getFullYear(),now.getMonth(),now.getDay());
    var tagDate = new Date(parseInt(arr[2]),parseInt(arr[1])-1,parseInt(arr[0]));
    if(tagDate < date)
    {
    	return true;
    }
    return false;
  },
  
  getLocalDirectory : function()
  {
  	let directoryService = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
  	// this is a reference to the profile dir (ProfD) now.
  	let localDir = directoryService.get("ProfD", Components.interfaces.nsIFile);

  	localDir.append("follow_up_log.txt");

  	if (!localDir.exists()) 
  	{
    	// read and write permissions to owner and group, read-only for others.
    	localDir.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0774);
  	}
  	return localDir;	
  },
  
  log : function(data)
  {
	var file = this.logFile;
	//var ostream = FileUtils.openSafeFileOutputStream(file);
	var ostream = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
	var istream = this.converter.convertToInputStream(data);
	ostream.init(file, 0x02 | 0x08 | 0x10, 0666, 0); 
	// The last argument (the callback) is optional.
	NetUtil.asyncCopy(istream, ostream, function(status) 
	{
  		if (!Components.isSuccessCode(status)) 
  		{
    		// Handle error!
    		return;
  		}
  		// Data has been written to the file.
  	});
  },
};



follow_up_tb = { 
	/*Code for the click of the follow-up button. It calls the datepicker window, creates / adds the tag to the email*/
    1: function () 
    {
    	var calName = follow_up_ext.prefs.getCharPref("extensions.follow_up_ext.calname");
		if(calName == "")
		{
			var params = { out: null };
    		window.openDialog("chrome://follow_up_ext/content/setup_wizard.xul", "", "modal", params).focus();
    		if(params.out != null)
    		{
    			follow_up_calendar.addFollowUpCalendar();
    			follow_up_ext.prefs.setIntPref("extensions.follow_up_ext.calpref",params.out);	
    		}
		}
		else
		{
    		follow_up_ext.addFollowUp();
    	}
    },

    /*This is the mark as done function. It marks done ALL the follow up tags set for that email. it also calls the remove unused tag function*/
    2: function ()
	
    {	
		follow_up_ext.markDone('',0);
    },
    /*This is the function on the View today click.*/
    3: function () 
    {
        var date = new Date();
        follow_up_ext.viewFollowUp(date);
    },
    /*This is the function on the View Pending click.*/
    4: function () 
    {
    	follow_up_ext.viewPending();
    },
    /*This function shows the preference window when the options menu is clicked*/
    5: function () 
    {
        window.openDialog("chrome://follow_up_ext/content/options.xul", "", "window", null).focus();
    },
    /*This function shows all the pending and the mails to follow up*/
    6: function ()
    {
    	follow_up_ext.showAll();
    },

};


var receiving = {
	
	getMessageId: function (aMsgHdr,paramTyp)
	{
		msgHdrGetHeaders(aMsgHdr, function (aHeaders) {
			var paramTypToLowCa = paramTyp.toLowerCase();
			if (aHeaders.has(paramTypToLowCa)){
			 receiving.purgeMail(aHeaders.get(paramTyp));
			}
		});
	},
	
	purgeMail: function (strmessageid)
	{		
		if (strmessageid != '')
		{
			let folder = gFolderDisplay.displayedFolder.messages;
			
			if(folder !='')
			{
				//for each mail in the folder
				while(folder.hasMoreElements()) {
					var found = false;
					let msgHdr = folder.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
					msgHdrGetHeaders(msgHdr, function (aHeaders) {
						var paramTyp = "Message-ID";
						var paramTypToLowCa = paramTyp.toLowerCase();
						if (aHeaders.has(paramTypToLowCa)){
							var couMesgId = aHeaders.get(paramTyp);
							if((couMesgId != '')){
								if(couMesgId == strmessageid){
									follow_up_ext.markDone(msgHdr,1);
									found = true;
								}
							}
						}
					});
					
					if(found){
						break;
					}
				}
			}
		}		
	},
};

 var newMailListener = {  
     msgAdded: function(aMsgHdr) {  
        receiving.getMessageId(aMsgHdr,"In-Reply-To");					 
	}  
};  
      
function init() {  
    var notificationService =  
    Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]  
    .getService(Components.interfaces.nsIMsgFolderNotificationService);  
    notificationService.addListener(newMailListener, notificationService.msgAdded);   
} ; 
        	
window.addEventListener("load", function () { follow_up_ext.onLoad(); follow_up_calendar.init(); }, false);
addEventListener("load", init, true);
