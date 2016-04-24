set "version=2.0.1"
del builds\zotero-scholar-citations-%version%-fx.xpi
rd /s/q builds\temp
mkdir builds\temp
mkdir builds\temp\chrome
xcopy /e chrome builds\temp\chrome
copy chrome.manifest builds\temp
copy install.rdf builds\temp
Wzzip -r -p builds\zotero-scholar-citations-%version%-fx.xpi builds\temp
rd /s/q builds\temp
