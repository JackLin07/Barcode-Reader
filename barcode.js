

let leftGuard, middleGuard, rightGuard, leftFirstDigit, l1D, l2D, l3D, l4D, l5D, l6D, r1D, r2D, r3D, r4D, r5D, r6D;

//let barcode = "10101011110111011011110100101110101011001111101010111011011011101110100101101010101101101000101";
let barcode = "10100011010110011001101101111010100011011100101010101000010001001001000111010011100101100110101";

decodeBarcodeFromAreas(barcode);

function decodeBarcodeFromAreas(areas)
{
    let result =
        {
            barcode: "", 
            message: "", 
            checksumValid: false
        };
    //Establish objects for reference of EAN barcodes
    let leftL = 
        {
            "0001101": 0,
            "0011001": 1,
            "0010011": 2,
            "0111101": 3,
            "0100011": 4,
            "0110001": 5,
            "0101111": 6,
            "0111011": 7,
            "0110111": 8,
            "0001011": 9
        };

    let leftG =
        {
            "0100111": 0,
            "0110011": 1,
            "0011011": 2,
            "0100001": 3,
            "0011101": 4,
            "0111001": 5,
            "0000101": 6,
            "0010001": 7,
            "0001001": 8,
            "0010111": 9
        };

    let rightR =
        { 
            "1110010": 0,
            "1100110": 1,
            "1101100": 2,
            "1000010": 3,
            "1011100": 4,
            "1001110": 5,
            "1010000": 6,
            "1000100": 7,
            "1001000": 8,
            "1110100": 9
        };

    //LHS parity pattern object needed to compare parity digit
    let LHS = 
        {
            "LLLLLL": 0,
            "LLGLGG": 1,
            "LLGGLG": 2,
            "LLGGGL": 3,
            "LGLLGG": 4,
            "LGGLLG": 5,
            "LGGGLL": 6,
            "LGLGLG": 7,
            "LGLGGL": 8,
            "LGGLGL": 9
        };


    // Empty string to store parity values
    let parity = "";
    
    // test to see if barcode is upside down
    // if it is, re-run function with reversed string
    if(leftL[areas.substr(3,7)===undefined])
    {
        return decodeBarcodeFromAreas(reverse(areas));
    }

    // for loop to calculate the first six digits and their  
    // parity, referring to the objects above to find where
    // the string matches.
    for (let i = 3; i < 45; i = i + 7)
    {
        if (leftL[areas.substr(i, 7)]!==undefined)
        {
            result.barcode += String(leftL[areas.substr(i, 7)]);
            parity += "L";
        }
        else if(leftG[areas.substr(i, 7)]!==undefined)
        {
            result.barcode += String(leftG[areas.substr(i,7)]);
            parity += "G";
        }
    }
	console.log(parity);
    // prepend parity digit to the first 6 digits
    result.barcode = LHS[parity]+result.barcode;
    

    // for loop to calculate the second set of six digit by 
    // matching the strings.
    for (let j = 50; j < 92; j = j + 7)
    {
        if (rightR[areas.substr(j, 7)]!==undefined)
        {
            result.barcode += rightR[areas.substr(j, 7)];
        }
    }
    return result;
}

function reverse(str){
    return str.split("").reverse().join("");
}








