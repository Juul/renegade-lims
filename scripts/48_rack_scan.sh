#!/bin/bash

if [ "$#" -lt "2" ]; then
    echo "Usage: $0 <input_file> <number_of_plates_to_scan>" >&2
    exit 1
fi

IN=$1
NUMBER_OF_PLATES=$2
FULL=/tmp/out.jpg
DMTXREAD=/usr/local/bin/dmtxread
TOP_OFFSET=216
LEFT_OFFSET_A=108
LEFT_OFFSET_B=3228
TUBE_SIZE_X=309
TUBE_SIZE_Y=312
IMAGE_HEIGHT=3064


#echo "Improving brightness and contrast"
#convert -brightness-contrast 20x60 $IN $FULL
convert -brightness-contrast 30x70 $IN $FULL
#cp $IN $FULL
#FULL=$IN


scan_plate() {
    RACK=$1
    LEFT_OFFSET=$2
    
#    echo "rack,row,column,barcode"
    #echo "Scanning rack A"
    for i in {0..7}; do
        for j in {0..5}; do
            #        echo "  Scanning tube ${j}x${i}"
            OFFSET_X=$(($LEFT_OFFSET + j * $TUBE_SIZE_X))
            OFFSET_X_MAX=$(($OFFSET_X + $TUBE_SIZE_X))
            OFFSET_Y=$(($IMAGE_HEIGHT - ($TOP_OFFSET + i * $TUBE_SIZE_Y)))
            OFFSET_Y_CONVERT=$(($TOP_OFFSET + i * $TUBE_SIZE_Y))
            OFFSET_Y_MAX=$(($OFFSET_Y - $TUBE_SIZE_Y))

            FILENAME=a_${j}x${i}.jpg
            #        echo "    $OFFSET_X x $OFFSET_Y"

            #        convert -crop ${TUBE_SIZE_X}x${TUBE_SIZE_Y}+${OFFSET_X}+${OFFSET_Y_CONVERT} $FULL out/$FILENAME
            #        CODE=$($DMTXREAD out/$FILENAME)

            CMD="$DMTXREAD -t 10 -q 10 -N 1 -x $OFFSET_X -X $OFFSET_X_MAX -y $OFFSET_Y_MAX -Y $OFFSET_Y $FULL"
            #        echo $CMD
            CODE=$($CMD)
            
            echo "$RACK,${j},${i},${CODE}"
        done
    done
}


scan_plate "a" $LEFT_OFFSET_A

if [ "$NUMBER_OF_PLATES" -gt "1" ]; then
    scan_plate "b" $LEFT_OFFSET_B
fi

#convert -crop 315x315+130+290 $FULL out/a_A1.jpg
#convert -crop 310x310+1680+290 $FULL out/a_F1.jpg
#convert -crop 315x315+1686+2516 $FULL out/a_F8.jpg
