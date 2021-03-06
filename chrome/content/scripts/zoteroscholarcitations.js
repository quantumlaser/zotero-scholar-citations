if (typeof Zotero === 'undefined') {
    Zotero = {};
}
Zotero.ScholarCitations = {};


Zotero.ScholarCitations.init = function() {
    Zotero.ScholarCitations.resetState();

    stringBundle = document.getElementById('zoteroscholarcitations-bundle');
    Zotero.ScholarCitations.captchaString = 'Please enter the Captcha on the page that will now open and then re-try updating the citations, or wait a while to get unblocked by Google if the Captcha is not present.';
    Zotero.ScholarCitations.citedPrefixString = ''
        if (stringBundle != null) {
            Zotero.ScholarCitations.captchaString = stringBundle.getString('captchaString');
        }

    // Register the callback in Zotero as an item observer
    var notifierID = Zotero.Notifier.registerObserver(
            Zotero.ScholarCitations.notifierCallback, ['item']);

    // Unregister callback when the window closes (important to avoid a memory leak)
    window.addEventListener('unload', function(e) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }, false);
};

Zotero.ScholarCitations.notifierCallback = {
    notify: function(event, type, ids, extraData) {
        if (event == 'add') {
            Zotero.ScholarCitations.updateItems(Zotero.Items.get(ids));
        }
    }
};

Zotero.ScholarCitations.resetState = function() {
    Zotero.ScholarCitations.current = -1;
    Zotero.ScholarCitations.toUpdate = 0;
    Zotero.ScholarCitations.itemsToUpdate = null;
    Zotero.ScholarCitations.numberOfUpdatedItems = 0;
    Zotero.ScholarCitations.openCitations = false;
    Zotero.ScholarCitations.openCitationsCount = 0;
    Zotero.ScholarCitations.openCitationsMax = 3;
    Zotero.ScholarCitations.baseUrl = 'https://scholar.google.com/';
    //Zotero.ScholarCitations.CitesUrl = new Array();
};

Zotero.ScholarCitations.updateSelectedEntity = function(libraryId) {
    if (!ZoteroPane.canEdit()) {
        ZoteroPane.displayCannotEditLibraryMessage();
        return;
    }

    var collection = ZoteroPane.getSelectedCollection();
    var group = ZoteroPane.getSelectedGroup();

    if (collection) {
        var items = [];
        collection.getChildren(true, false, 'item').forEach(function (item) {
            items.push(Zotero.Items.get(item.id));
        });
        Zotero.ScholarCitations.updateItems(items);
    } else if (group) {
        if (!group.editable) {
            alert("This group is not editable!");
            return;
        }
        var items = [];
        group.getCollections().forEach(function(collection) {
            collection.getChildren(true, false, 'item').forEach(function(item) {
                items.push(Zotero.Items.get(item.id));
            })
        });
        Zotero.ScholarCitations.updateItems(items);
    } else {
        Zotero.ScholarCitations.updateAll();
    }
};

Zotero.ScholarCitations.clearSelectedItems = function() {
    Zotero.ScholarCitations.clearItems(ZoteroPane.getSelectedItems());
};

Zotero.ScholarCitations.clearItems = function(items){
    items.forEach(function(item) {
        item.setField('extra', '');
    });
};

Zotero.ScholarCitations.updateSelectedItems = function() {
    Zotero.ScholarCitations.updateItems(ZoteroPane.getSelectedItems());
};

Zotero.ScholarCitations.updateAll = function() {
    var items = [];
    Zotero.Items.getAll().forEach(function (item) {
        if (item.isRegularItem() && !item.isCollection()) {
            var libraryId = item.getField('libraryID');
            if (libraryId == null ||
                    libraryId == '' ||
                    Zotero.Libraries.isEditable(libraryId)) {
                items.push(item);
            }
        }
    });
    Zotero.ScholarCitations.updateItems(items);
};

Zotero.ScholarCitations.searchSelectedItems = function() {
    Zotero.ScholarCitations.searchItems(ZoteroPane.getSelectedItems());
};

Zotero.ScholarCitations.updateItems = function(items) {
    if (items.length == 0 ||
            Zotero.ScholarCitations.numberOfUpdatedItems < Zotero.ScholarCitations.toUpdate) {
        return;
    }

    Zotero.ScholarCitations.resetState();
    Zotero.ScholarCitations.toUpdate = items.length;
    Zotero.ScholarCitations.itemsToUpdate = items;
    Zotero.ScholarCitations.updateNextItem();
};

Zotero.ScholarCitations.searchItems = function(items) {
    if (items.length == 0 ||
            Zotero.ScholarCitations.numberOfUpdatedItems < Zotero.ScholarCitations.toUpdate) {
        return;
    }

    Zotero.ScholarCitations.resetState();
    Zotero.ScholarCitations.openCitations = true;
    Zotero.ScholarCitations.toUpdate = items.length;
    Zotero.ScholarCitations.itemsToUpdate = items;
    Zotero.ScholarCitations.updateNextItem();
};

Zotero.ScholarCitations.generateCitesUrl = function(responseText) {
    if (responseText == '') {
        return null;
    }

    var citeStringLength = 15;
    var lengthOfCiteByStr = 9;
    var citeArray = new Array();

    var citeExists = responseText.search('Cited by');
    if (citeExists == -1) {
        return null;
    }

    var citesStart = responseText.search('scholar\\?cites');
    if (citesStart == -1) {
        return null;
    }

    var citesUrl = Zotero.ScholarCitations.baseUrl +
        responseText.substr(citesStart, citeExists-citesStart-2);

    return citesUrl;
};

Zotero.ScholarCitations.updateNextItem = function() {
    Zotero.ScholarCitations.numberOfUpdatedItems++;

    if (Zotero.ScholarCitations.current == Zotero.ScholarCitations.toUpdate - 1) {
        Zotero.ScholarCitations.resetState();
        return;
    }

    Zotero.ScholarCitations.current++;
    Zotero.ScholarCitations.updateItem(
            Zotero.ScholarCitations.itemsToUpdate[Zotero.ScholarCitations.current]);
};

Zotero.ScholarCitations.generateItemUrl = function(item) {
    var baseUrl = Zotero.ScholarCitations.baseUrl;//'http://scholar.google.org/';
    var url = baseUrl +
        'scholar?hl=en&as_q=' +
        encodeURIComponent(item.getField('title')).replace(/ /g, '+') +
        '&as_occt=title&num=1';

    var creators = item.getCreators();
    if (creators.length > 0) {
        url += '&as_sauthors=' +
            encodeURIComponent(creators[0].ref.lastName).replace(/ /g, '+');
    } else {
        var date = item.getField('date');
        if (date != '') {
            url += '&as_ylo=' + date + '&as_yhi=' + date;
        }
    }

    return url;
};

Zotero.ScholarCitations.updateItem = function(item) {
    if (typeof item.attachmentHash !== 'undefined') {
        Zotero.ScholarCitations.updateNextItem();
        return;
    }

    var req = new XMLHttpRequest();
    var url = Zotero.ScholarCitations.generateItemUrl(item);
    req.open('GET', url, true);

    req.onreadystatechange = function() {
        if (req.readyState == 4) {
            if (req.status == 200 && req.responseText.search("RecaptchaOptions") == -1) {
                if (item.isRegularItem() && !item.isCollection()) {
                    var citations = Zotero.ScholarCitations.getCitationCount(
                        req.responseText);
                    try{
                        if(citations != '0'
                            && Zotero.ScholarCitations.openCitations == true
                            && Zotero.ScholarCitations.openCitationsCount
                             < Zotero.ScholarCitations.openCitationsMax) {
                                // windows.open('http://baidu.com');
                                var citesUrl = Zotero.ScholarCitations.generateCitesUrl(
                                        req.responseText);
                                window.open(citesUrl);
                                //Zotero.ScholarCitations.citesUrl[Zotero.ScholarCitations.openCitationsCount] = citesUrl;
                                Zotero.ScholarCitations.openCitationsCount++;
                            }
                    } catch(e){}

                    try {
                        var old = item.getField('extra');
                        item.setField('extra', citations);
                        // This will lose old extra!
                        if(false){
                            if (old.length == 0 || old.search(/^\d{5}$/) != -1) {
                                item.setField('extra', citations);
                            } else if (old.search(/^\d{5} *\n/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^\d{5} */, citations + ' '));
                            } else if (old.search(/^\d{5} *[^\n]+/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^\d{5} */, citations + ' \n'));
                            } else if (old.search(/^\d{5}/) != -1) {
                                item.setField(
                                        'extra',
                                        old.replace(/^\d{5}/, citations));
                            } else {
                                item.setField('extra', citations + ' \n' + old);
                            }
                        }

                        item.save();
                    } catch (e) {}
                }
                Zotero.ScholarCitations.updateNextItem();
            } else if (req.status == 200 ||
                    req.status == 403 ||
                    req.status == 503) {
                alert(Zotero.ScholarCitations.captchaString);
                req2 = new XMLHttpRequest();
                req2.open('GET', url, true);
                req2.onreadystatechange = function() {
                    if (req2.readyState == 4) {
                        if (typeof ZoteroStandalone !== 'undefined') {
                            ZoteroStandalone.openInViewer(url);
                        } else {
                            window.gBrowser.loadOneTab(
                                    url, {inBackground: false});
                        }
                        Zotero.ScholarCitations.resetState();
                    }
                }
                req2.send(null);
            }
        }
    };

    req.send(null);
};

Zotero.ScholarCitations.fillZeros = function(number) {
    var output = '';
    var cnt = 5 - number.length;
    for (var i = 0; i < cnt; i++) {
        output += '0';
    }
    output += number;
    return output;
};

Zotero.ScholarCitations.fillSpaces = function(number) {
    var output = '';
    var cnt = 5 - number.length;
    for (var i = 0; i < cnt; i++) {
        output += ' ';
    }
    output += number;
    return output;
};

Zotero.ScholarCitations.getCitationCount = function(responseText) {
    if (responseText == '') {
        return '0';
    }

    var citeStringLength = 15;
    var lengthOfCiteByStr = 9;
    var citeArray = new Array();

    var citeExists = responseText.search('Cited by');
    if (citeExists == -1) {
        return '0';
    }

    var tmpString = responseText.substr(citeExists, citeStringLength);
    var end = tmpString.indexOf('<') - lengthOfCiteByStr;
    return tmpString.substr(lengthOfCiteByStr, end);
};

if (typeof window !== 'undefined') {
    window.addEventListener('load', function(e) {
        Zotero.ScholarCitations.init();
    }, false);
}

module.exports = Zotero.ScholarCitations;
