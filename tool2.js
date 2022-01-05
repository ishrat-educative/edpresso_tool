const Interval = 30000;
var urlArray = [];
var count_test = 0;

const axios = require("axios");
const convert = require("xml-js");

const RateLimiter = require("limiter").RateLimiter;
const limiter = new RateLimiter(2, "second");

var async = require("async");

const PUBSHLISHED_URL = "https://www.educative.io/sitemap.xml";
var friendly_ids = [];

// fetch all data from https://www.educative.io/sitemap.xml
axios
  .get(PUBSHLISHED_URL)
  .then((response) => {
    const json_data = JSON.parse(
      convert.xml2json(response.data, { compact: true, spaces: 2 })
    );
    // filter fetched data for links starting with https://www.educative.io/edpresso/
    let allshots = json_data.urlset.url.filter((shot) => {
      return shot.loc._text
        .toLowerCase()
        .includes("https://www.educative.io/edpresso/".toLowerCase());
    });
    console.log(allshots);

    //filter shots urls for friendly ids
    friendly_ids = allshots.map((shot) => {
      return shot.loc._text.split("/")[4];
    });
    console.log(friendly_ids.length);

    // sart scheduling api calls for the shots json objects
    if (friendly_ids != null && friendly_ids.length > 0) {
      console.log("Fetching text");

      let start_index = 0;
      let end_index = 500;

      console.log(
        "Scheduling api calls for " + start_index + ":" + end_index + " .... \n"
      );
      setTimeout(
        apiCall,
        1,
        friendly_ids.slice(start_index, end_index),
        start_index,
        end_index,
        friendly_ids
      );
    }
  })
  .catch((err) => {
    console.log("Error in retrieving all shots: " + err);
  });

const apiCall = (f_ids, start_index, end_index, friendly_ids) => {
  async.forEachOf(
    f_ids,
    (f_id, index) => {
      axios
        .get("https://www.educative.io/api/edpresso/shot/url/" + f_id)
        .then((response) => {
          let contentArray = response.data.content;
          var writeToBothFiles = true;
          if (contentArray != null && contentArray.length > 0) {
            //loopp: contentArray.forEach((content) => {
            loopp: for (let m = 0; m < contentArray.length; m++) {
              let content = contentArray[m];
              if (
                content.type
                  .toLowerCase()
                  .includes("MarkdownEditor".toLowerCase())
              ) {
                let html = content.content.mdHtml;
                const anchor_starting_indexes = [
                  ...html.matchAll(new RegExp("<a href=", "gi")),
                ].map((a) => a.index);

                const anchor_ending_indexes = [
                  ...html.matchAll(new RegExp("</a>", "gi")),
                ].map((a) => a.index);

                //anchor_starting_indexes.forEach((sIndex, index) => {
                for (let k = 0; k < anchor_starting_indexes.length; k++) {
                  let sIndex = anchor_starting_indexes[k];
                  let index = k;
                  let anchor = html.substring(
                    sIndex,
                    anchor_ending_indexes[index]
                  );

                  let split1 = anchor.split('<a href="');
                  if (split1.length > 1) {
                    let split2 = split1[1].split('">');
                    if (split2.length > 0) {
                      let url = split2[0];
                      if (!url.startsWith("https://www.educative.io")) {
                        console.log(url);
                        count_test++;
                        console.log(count_test);

                        let shot_url =
                          "https://www.educative.io/edpresso/" + f_id;
                        let external_link = url;

                        writeToExcel(
                          shot_url,
                          response.data.title,
                          external_link,
                          split2[1],
                          writeToBothFiles
                        );

                        writeToBothFiles = false;
                        //break loopp;
                      }
                    }
                  }
                }
              }
            }
          }
        })
        .catch((err) => {
          console.log(
            "Error in fetching data from api: " +
              "https://www.educative.io/api/edpresso/shot/url/" +
              f_id +
              "\n" +
              err
          );
        });
    },
    (err) => {}
  );

  start_index = end_index;
  end_index += 500;
  if (start_index < friendly_ids.length) {
    let terminating_index =
      end_index < friendly_ids.length ? end_index : friendly_ids.length;
    console.log(
      "Scheduling api calls for shots" +
        start_index +
        ":" +
        terminating_index +
        " .... \n"
    );
    setTimeout(
      apiCall,
      Interval,
      friendly_ids.slice(start_index, terminating_index),
      start_index,
      terminating_index,
      friendly_ids
    );
  }
};

// Write to Excel data
const Excel = require("exceljs");

// Create a new instance of a Workbook class
const workbook = new Excel.Workbook();

var worksheet1, worksheet2;

var linkStyle;
workbook.xlsx.readFile("Edpresso.xlsx").then(() => {
  worksheet1 = workbook.getWorksheet("Edpresso_Shots_Only");
  worksheet2 = workbook.getWorksheet("Edpresso_details");

  linkStyle = {
    underline: true,
    color: { argb: "FF0000FF" },
  };

  worksheet1.columns = [{ header: "Shot Link", key: "sLink", width: 40 }];

  worksheet2.columns = [
    { header: "Shot Link", key: "sLink", width: 40 },
    { header: "External Link", key: "eLink", width: 32 },
  ];
});

const writeToExcel = (
  shot_url,
  shot_title,
  external_link,
  external_link_title,
  writeToBothFiles
) => {
  var tempBool = false;
  if (
    shot_title.toLowerCase().includes("Beginner's guide to SASS".toLowerCase())
  ) {
    console.log("setting tempBool true");
    console.log("WriteToBothFiles is " + writeToBothFiles);

    tempBool = true;
  }
  if (writeToBothFiles) {
    if (tempBool) {
      console.log(tempBool);
      console.log("Inside if for row1 in workbook 1");
    }
    let row1 = worksheet1.addRow({
      sLink: {
        text: shot_title,
        hyperlink: shot_url,
      },
    });
    row1.getCell(1).font = linkStyle;
  }
  let row2 = worksheet2.addRow({
    eLink: {
      text: external_link_title,
      hyperlink: external_link,
    },
    sLink: {
      text: shot_title,
      hyperlink: shot_url,
    },
  });

  row2.getCell(1).font = linkStyle;
  row2.getCell(2).font = linkStyle;

  // save under export.xlsx
  try {
    workbook.xlsx.writeFile("Edpresso.xlsx");
  } catch (err) {
    console.log("Could not write to the excel file Edpresso.xlsx: " + err);
  }
};
