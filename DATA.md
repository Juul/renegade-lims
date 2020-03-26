
# Container

* type: "physical"
* subtype: "container" or "rna_plate" or "qpcr_plate"
* name: human readable name (string)
* location: location object
* createdAt: timestamp
* createdBy: user id
* wells: object

## subtype

container: e.g. a freezer or cabinet
rna_plate: Plate of extracted RNA from swabs.
qpcr_plate: Plate for use in qPCR machine

## wells

Only for subtype "rna_plate" and "qpcr_plate"

```
{
  a1: swabID,
  b12: swabID,
  ...
}
```

# location object

Used a field for Container and Plate.

```
{
  parent_id: uuid of parent container (if any)
  description: additional human readable info about location (string)
}
```

For a shelf in a -80 freezer the parent_id would be the uuid of the freezer (also a Container) and the description would say "top shelf".

# User

* type: "user"
* id: uuid
* username
* password
* groups
* createdAt: timestamp
* createdBy: user id

## username

Human readable name of user. Not their real name.

## password

<uuid salt>!<sha256 hash of password>

## groups

Array of group names (strings) such as 'admin'.

# Swab

* type: "swab"
* id: uuid
* isExternal: boolean
* isPriority: boolean
* createdAt: timestamp
* createdBy: user id
* location

## isExternal

Was this swabbed using our swab collecting system or was it supplied by an outside company. True if outside company.

## isPriority

Should this swab be given priority?

## createdBy

If `isExternal` is false then this needs to be set to the user id of the logged in user on the swab collection computer.

If `isExternal` is true then this will be a unique user id of a user created for the company that delivered the swab.

## createdAt

If isExternal is false then this is a the time this swab was created in the field, otherwise this is the time the swab tube was scanned after it arrived at the lab.

## location

Where this was swabbed. Not yet specified if this is coordinates, address or something else
